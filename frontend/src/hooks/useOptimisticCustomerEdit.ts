import { useMutation, useQueryClient } from '@tanstack/react-query';
import { http } from '@/lib/api';
import { useConflictManager } from '@/conflict/ConflictProvider';
import type { CustomerProfile } from '@/types/customerProfile';
import type { AxiosResponseHeaders } from 'axios';

interface EditCustomerPatch { full_name?: string; phone?: string | null; email?: string | null; address?: string | null }
interface EditCustomerPayload { id: string; patch: EditCustomerPatch }
interface ApiResponse { data: { id: string; name?: string; email?: string | null; phone?: string | null; address?: string | null } }
interface MutationResult { json: ApiResponse; etag?: string; aborted?: boolean }
// Extend locally to optionally include address on customer (backend may introduce later)
interface CustomerWithOptionalAddress extends CustomerProfile { customer: CustomerProfile['customer'] & { address?: string | null } }
type AugmentedCustomerProfile = CustomerWithOptionalAddress & { _etag?: string; etag?: string };

function getHeader(headers: AxiosResponseHeaders | Record<string, string> | undefined, key: string): string | undefined {
  if (!headers) return undefined;
  // Axios in browser exposes a plain object with lowercase header keys
  const lower = key.toLowerCase();
  const val = (headers as Record<string, string>)[lower];
  return typeof val === 'string' ? val : undefined;
}

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
  const res = await http.patch(`/admin/customers/${input.id}`, body, { headers: { ...(etag ? { 'If-Match': etag } : {}) }, validateStatus: (s) => (s >= 200 && s < 300) || s === 412 });
  if (res.status === 412) {
        // Fetch latest server version for diff (GET fresh)
        const latestRes = await http.get(`/admin/customers/${input.id}`);
        const latestJson = latestRes.data || null;
        const latestData = latestJson && (latestJson as Record<string, unknown>).data ? (latestJson as Record<string, unknown>).data : latestJson;
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
            const etagHdr = getHeader(latestRes.headers as unknown as Record<string, string>, 'ETag');
            qc.setQueryData(queryKey, { ...(existing || {}), customer: { ...(existing?.customer || {}), full_name: (latestData as { name?: string; full_name?: string }).name ?? (latestData as { full_name?: string }).full_name, phone: (latestData as { phone?: string | null }).phone, email: (latestData as { email?: string | null }).email }, _etag: etagHdr || existing?._etag });
          }
          const etagHdr = getHeader(latestRes.headers as unknown as Record<string, string>, 'ETag');
          return { json: { data: { id: input.id } }, etag: etagHdr, aborted: true };
        }
        if (choice === 'overwrite') {
          // Retry without If-Match (force overwrite)
          const retryRes = await http.patch(`/admin/customers/${input.id}`, body);
          const retryJson: ApiResponse = retryRes.data as ApiResponse;
          const retryEtag = getHeader(retryRes.headers as unknown as Record<string, string>, 'ETag');
          return { json: retryJson, etag: retryEtag };
        }
        throw Object.assign(new Error('Conflict unresolved'), { status: 412, handled: true });
      }
  const json: ApiResponse = (res.data as ApiResponse);
  const newEtag = getHeader(res.headers as unknown as Record<string, string>, 'ETag');
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
