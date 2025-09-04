import { useMutation, useQueryClient } from '@tanstack/react-query';
// Use fetch in this hook to simplify unit tests that stub global fetch
import { useConflictManager } from '@/conflict/ConflictProvider';

export interface BasicVehicle {
  id: string | number;
  make?: string | null;
  model?: string | null;
  year?: number | null;
  vin?: string | null;
  license_plate?: string | null;
  _etag?: string;
  etag?: string; // legacy
}

interface VehiclePatch { make?: string | null; model?: string | null; year?: number | null; vin?: string | null; license_plate?: string | null }
interface ApiResponse { data: BasicVehicle }
interface MutationResult { json: ApiResponse; etag?: string; aborted?: boolean }

// Query key chosen; adjust to match whichever component consumes base vehicle info.
function vehicleBasicKey(id: string | number) { return ['vehicleBasic', String(id)] as const; }

function getHeader(headers: Headers | Record<string, string> | undefined, key: string): string | undefined {
  if (!headers) return undefined;
  // Duck-type instead of instanceof to avoid cross-realm issues in tests
  const anyHeaders = headers as unknown as { get?: (name: string) => string | null };
  if (anyHeaders && typeof anyHeaders.get === 'function') {
    return anyHeaders.get(key) ?? anyHeaders.get(key.toLowerCase()) ?? undefined;
  }
  const lower = key.toLowerCase();
  // Also check exact case just in case
  return (headers as Record<string, string>)[lower] ?? (headers as Record<string, string>)[key];
}

export function useOptimisticVehicleEdit(vehicleId: string) {
  const qc = useQueryClient();
  const key = vehicleBasicKey(vehicleId);
  const { openConflict } = useConflictManager();
  return useMutation({
  mutationFn: async (patch: VehiclePatch): Promise<MutationResult> => {
      const existing = qc.getQueryData<BasicVehicle>(key);
      const etag = existing?._etag || existing?.etag;
      const res = await fetch(`/api/admin/vehicles/${vehicleId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...(etag ? { 'If-Match': etag } : {}) },
        body: JSON.stringify(patch),
      });
      if (res.status === 412) {
        const latestRes = await fetch(`/api/admin/vehicles/${vehicleId}`);
        const latestJson = await latestRes.json().catch(() => null as unknown);
        const latestData = latestJson && (latestJson as Record<string, unknown>)?.data ? (latestJson as Record<string, unknown>).data : latestJson;
        const choice = await openConflict({
          kind: 'vehicle',
          id: vehicleId,
          local: (existing as unknown as Record<string, unknown>) || null,
          remote: (latestData as Record<string, unknown>) || null,
          patch: { ...patch } as Record<string, unknown>,
          fields: [
            { key: 'make', label: 'Make' },
            { key: 'model', label: 'Model' },
            { key: 'year', label: 'Year' },
            { key: 'vin', label: 'VIN' },
            { key: 'license_plate', label: 'Plate' },
          ] as unknown as { key: string; label?: string }[],
        });
        if (choice === 'discard') {
          if (latestData) {
            const etagHdr = getHeader(latestRes.headers, 'ETag');
            qc.setQueryData(key, { ...(existing || {}), ...latestData, _etag: etagHdr || existing?._etag });
          }
          const etagHdr = getHeader(latestRes.headers, 'ETag');
          return { json: { data: { id: vehicleId } as BasicVehicle }, etag: etagHdr, aborted: true };
        }
        if (choice === 'overwrite') {
          const retryRes = await fetch(`/api/admin/vehicles/${vehicleId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(patch) });
          const retryJson: ApiResponse = await retryRes.json();
          const retryEtag = getHeader(retryRes.headers, 'ETag');
          return { json: retryJson, etag: retryEtag };
        }
        throw Object.assign(new Error('Conflict unresolved'), { status: 412, handled: true });
      }
      const json: ApiResponse = await res.json();
      const newEtag = getHeader(res.headers, 'ETag');
      return { json, etag: newEtag };
    },
    onMutate: async (patch) => {
      await qc.cancelQueries({ queryKey: key });
      const prev = qc.getQueryData<BasicVehicle>(key);
      if (prev) {
        const optimistic: BasicVehicle = { ...prev, ...patch };
        qc.setQueryData(key, optimistic);
      }
      return { prev };
    },
    onError: (err, _vars, ctx) => { if ((err as { handled?: boolean })?.handled) return; if (ctx?.prev) qc.setQueryData(key, ctx.prev); },
    onSuccess: (result) => {
      if (result.aborted) return;
      const prev = qc.getQueryData<BasicVehicle>(key) || ({} as BasicVehicle);
      const merged: BasicVehicle = { ...prev, ...result.json.data };
      if (result.etag) merged._etag = result.etag;
      qc.setQueryData(key, merged);
    },
  });
}
