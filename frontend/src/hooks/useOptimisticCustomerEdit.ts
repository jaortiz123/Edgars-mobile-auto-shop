import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useConflictManager } from '@/conflict/ConflictProvider';
import type { CustomerProfile } from '@/types/customerProfile';

interface EditCustomerPatch { full_name?: string; phone?: string | null; email?: string | null; address?: string | null }
interface EditCustomerPayload { id: string; patch: EditCustomerPatch }
interface ApiResponse { data: { id: string; name?: string; email?: string | null; phone?: string | null; address?: string | null } }
interface MutationResult { json: ApiResponse; etag?: string; aborted?: boolean }
// Extend locally to optionally include address on customer (backend may introduce later)
interface CustomerWithOptionalAddress extends CustomerProfile { customer: CustomerProfile['customer'] & { address?: string | null } }
type AugmentedCustomerProfile = CustomerWithOptionalAddress & { _etag?: string; etag?: string };

// The "useCustomerProfile" hook uses a 7‑segment key: ['customerProfile', id, vehicleId, from, to, includeInvoices, limitAppointments]
// To remain interoperable we align to that shape with default null/false placeholders so optimistic updates reflect in consumers.
function customerProfileBaseKey(id: string) {
  return ['customerProfile', id, null, null, null, false, null] as const;
}

export function useOptimisticCustomerEdit(profileId: string) {
  const qc = useQueryClient();
  const queryKey = customerProfileBaseKey(profileId);
  const { openConflict } = useConflictManager();
  return useMutation({
  mutationFn: async (input: EditCustomerPayload): Promise<MutationResult> => {
      const existing = qc.getQueryData<AugmentedCustomerProfile>(queryKey);
      const etag = existing?._etag || existing?.etag;
      const body: Record<string, unknown> = {};
      if (input.patch.full_name !== undefined) body.name = input.patch.full_name;
      if (input.patch.phone !== undefined) body.phone = input.patch.phone;
      if (input.patch.email !== undefined) body.email = input.patch.email;
      if (input.patch.address !== undefined) body.address = input.patch.address;
      const res = await fetch(`/api/admin/customers/${input.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...(etag ? { 'If-Match': etag } : {}) },
        body: JSON.stringify(body),
      });
      if (res.status === 412) {
        // Fetch latest server version for diff (GET fresh)
        const latestRes = await fetch(`/api/admin/customers/${input.id}`);
        const latestJson = latestRes.ok ? await latestRes.json() : null;
        const latestData = latestJson && latestJson.data ? latestJson.data : latestJson;
        const choice = await openConflict({
          kind: 'customer',
          id: input.id,
          local: (existing as unknown as Record<string, unknown>) || null,
          remote: (latestData as Record<string, unknown>) || null,
          patch: { ...input.patch } as Record<string, unknown>,
          fields: [
            { key: 'full_name', label: 'Name' },
            { key: 'phone', label: 'Phone' },
            { key: 'email', label: 'Email' },
          ] as unknown as { key: string; label?: string }[],
        });
        if (choice === 'discard') {
          if (latestData) {
            qc.setQueryData(queryKey, { ...(existing || {}), customer: { ...(existing?.customer || {}), full_name: latestData.name ?? latestData.full_name, phone: latestData.phone, email: latestData.email }, _etag: latestRes.headers.get('ETag') || existing?._etag });
          }
          return { json: { data: { id: input.id } }, etag: latestRes.headers.get('ETag') || undefined, aborted: true };
        }
        if (choice === 'overwrite') {
          // Retry without If-Match (force overwrite)
          const retryRes = await fetch(`/api/admin/customers/${input.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
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
    onMutate: async (input) => {
      await qc.cancelQueries({ queryKey });
      const prev = qc.getQueryData<AugmentedCustomerProfile>(queryKey);
      if (prev) {
        const optimistic: AugmentedCustomerProfile = { ...prev };
        if (input.patch.full_name !== undefined) optimistic.customer.full_name = input.patch.full_name!;
        if (input.patch.phone !== undefined) optimistic.customer.phone = input.patch.phone;
        if (input.patch.email !== undefined) optimistic.customer.email = input.patch.email;
        if (input.patch.address !== undefined && Object.prototype.hasOwnProperty.call(optimistic.customer, 'address')) {
          (optimistic.customer as { address?: string | null }).address = input.patch.address;
        }
        qc.setQueryData(queryKey, optimistic);
      }
      return { prev };
    },
    onError: (err, _vars, ctx) => { if ((err as { handled?: boolean })?.handled) return; if (ctx?.prev) qc.setQueryData(queryKey, ctx.prev); },
    onSuccess: (result) => {
      if (result.aborted) return; // already replaced cache on discard path
      const prev = qc.getQueryData<AugmentedCustomerProfile>(queryKey);
      if (prev) {
        const merged: AugmentedCustomerProfile = { ...prev };
        if (result.json.data.name !== undefined) merged.customer.full_name = result.json.data.name!;
        if (result.json.data.phone !== undefined) merged.customer.phone = result.json.data.phone;
        if (result.json.data.email !== undefined) merged.customer.email = result.json.data.email;
        if (result.json.data.address !== undefined && Object.prototype.hasOwnProperty.call(merged.customer, 'address')) {
          (merged.customer as { address?: string | null }).address = result.json.data.address;
        }
        if (result.etag) merged._etag = result.etag;
        qc.setQueryData(queryKey, merged);
      }
    },
  });
}
