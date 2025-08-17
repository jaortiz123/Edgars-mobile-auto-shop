import React from 'react';
import { Button } from '../../components/ui/Button';

interface Props {
  open: boolean;
  onCancel: () => void;
  onConfirm: () => void;
  submitting?: boolean;
  errorMessage?: string | null;
}

export function VoidInvoiceConfirmModal({ open, onCancel, onConfirm, submitting, errorMessage }: Props) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black/40 z-50" data-testid="void-confirm-modal">
      <div className="bg-white rounded shadow-lg w-full max-w-sm p-6 space-y-4">
        <h2 className="text-lg font-semibold">Void Invoice</h2>
        <p className="text-sm text-gray-700">Are you sure you want to void this invoice? This action cannot be undone.</p>
        {errorMessage && <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded p-2" role="alert" data-testid="void-error">{errorMessage}</div>}
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={onCancel} disabled={submitting}>Cancel</Button>
          <Button variant="destructive" onClick={onConfirm} disabled={submitting} data-testid="void-confirm-btn">
            {submitting ? 'Voiding...' : 'Confirm Void'}
          </Button>
        </div>
      </div>
    </div>
  );
}
