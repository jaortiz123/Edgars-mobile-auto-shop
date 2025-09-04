import React, { useState, useEffect } from 'react';
import { useOptimisticCustomerEdit } from '@/hooks/useOptimisticCustomerEdit';
import type { CustomerProfile } from '@/types/customerProfile';

interface Props {
  open: boolean;
  onClose: () => void;
  profile: CustomerProfile | null;
}

export function CustomerEditModal({ open, onClose, profile }: Props) {
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState<string | null>('');
  const [email, setEmail] = useState<string | null>('');
  const mutation = useOptimisticCustomerEdit(profile?.customer.id || '');

  useEffect(() => {
    if (profile) {
      setFullName(profile.customer.full_name);
      setPhone(profile.customer.phone ?? '');
      setEmail(profile.customer.email ?? '');
    }
  }, [profile]);

  if (!open || !profile) return null;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    mutation.mutate(
      { id: profile.customer.id, patch: { full_name: fullName, phone: phone || null, email: email || null } },
      {
        onSuccess: (result: unknown) => {
          const r = result as { aborted?: boolean } | null;
          if (!r?.aborted) onClose();
        },
      }
    );
  };

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black/40 z-50" data-testid="customer-edit-modal">
      <form onSubmit={submit} className="bg-white rounded shadow p-6 w-full max-w-md space-y-4" aria-label="Edit Customer">
        <h2 className="text-lg font-semibold">Edit Customer</h2>
        <label className="block text-sm font-medium">Full Name
          <input value={fullName} onChange={e => setFullName(e.target.value)} className="mt-1 w-full border rounded px-2 py-1" />
        </label>
        <label className="block text-sm font-medium">Phone
          <input value={phone ?? ''} onChange={e => setPhone(e.target.value)} className="mt-1 w-full border rounded px-2 py-1" />
        </label>
        <label className="block text-sm font-medium">Email
          <input value={email ?? ''} onChange={e => setEmail(e.target.value)} className="mt-1 w-full border rounded px-2 py-1" />
        </label>
        {mutation.isError && <div className="text-sm text-red-600" role="alert">Update failed</div>}
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="px-3 py-2 border rounded" disabled={mutation.isPending}>Cancel</button>
          <button type="submit" className="px-3 py-2 bg-blue-600 text-white rounded" disabled={mutation.isPending}>{mutation.isPending ? 'Saving…' : 'Save'}</button>
        </div>
      </form>
    </div>
  );
}

export default CustomerEditModal;
