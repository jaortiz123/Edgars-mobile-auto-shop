import { useMutation, useQueryClient } from '@tanstack/react-query';
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
        const latestJson = latestRes.ok ? await latestRes.json() : null;
        const latestData = latestJson && latestJson.data ? latestJson.data : latestJson;
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
            qc.setQueryData(key, { ...(existing || {}), ...latestData, _etag: latestRes.headers.get('ETag') || existing?._etag });
          }
          return { json: { data: { id: vehicleId } as BasicVehicle }, etag: latestRes.headers.get('ETag') || undefined, aborted: true };
        }
        if (choice === 'overwrite') {
          const retryRes = await fetch(`/api/admin/vehicles/${vehicleId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(patch),
          });
          if (!retryRes.ok) throw Object.assign(new Error(`HTTP ${retryRes.status}`), { status: retryRes.status });
          const retryJson: ApiResponse = await retryRes.json();
          const retryEtag = retryRes.headers.get('ETag') || undefined;
      return { json: retryJson, etag: retryEtag };
        }
        throw Object.assign(new Error('Conflict unresolved'), { status: 412, handled: true });
      }
      if (!res.ok) throw Object.assign(new Error(`HTTP ${res.status}`), { status: res.status });
      const json: ApiResponse = await res.json();
      const newEtag = res.headers.get('ETag') || undefined;
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
