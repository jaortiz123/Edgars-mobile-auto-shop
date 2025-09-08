import React, { useEffect, useState, useCallback } from 'react';

export interface RecordPaymentFormValues {
  amountCents: number; // integer cents
  method: string;
  receivedDate: string; // YYYY-MM-DD
  note?: string;
}

interface RecordPaymentModalProps {
  open: boolean;
  amountDueCents: number;
  invoiceStatus: string;
  onClose(): void;
  onSubmit?(values: RecordPaymentFormValues): void;
  submitting?: boolean;
  errorMessage?: string | null;
}

function centsToDollarsString(cents: number): string {
  return (cents / 100).toFixed(2);
}

function todayIsoDate(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export const RecordPaymentModal: React.FC<RecordPaymentModalProps> = ({
  open,
  amountDueCents,
  invoiceStatus,
  onClose,
  onSubmit,
  submitting,
  errorMessage,
}) => {
  const [amount, setAmount] = useState<string>('');
  const [method, setMethod] = useState<string>('cash');
  const [receivedDate, setReceivedDate] = useState<string>(todayIsoDate());
  const [note, setNote] = useState<string>('');
  const [touched, setTouched] = useState<boolean>(false);

  useEffect(() => {
    if (open) {
      setAmount(centsToDollarsString(amountDueCents));
  setMethod('cash');
      setReceivedDate(todayIsoDate());
      setNote('');
      setTouched(false);
    }
  }, [open, amountDueCents]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose]);

  const parsedAmountCents = (() => {
    const n = parseFloat(amount);
    if (isNaN(n) || n <= 0) return 0;
    return Math.round(n * 100);
  })();

  const amountError = touched && parsedAmountCents <= 0 ? 'Enter a positive amount' : null;
  const overpayWarning = parsedAmountCents > amountDueCents && amountDueCents > 0;
  const disabled = submitting || parsedAmountCents <= 0 || !!amountError;

  const handleSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    setTouched(true);
    if (disabled) return;
    onSubmit?.({ amountCents: parsedAmountCents, method, receivedDate, note: note.trim() || undefined });
  }, [disabled, parsedAmountCents, method, receivedDate, note, onSubmit]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 p-6" role="dialog" aria-modal="true" aria-labelledby="record-payment-title">
      <div className="w-full max-w-md rounded bg-white shadow-xl flex flex-col max-h-[90vh]" data-testid="record-payment-modal">
        <form onSubmit={handleSubmit} className="flex flex-col flex-1">
          <div className="border-b px-4 py-3 flex items-center gap-3">
            <h2 id="record-payment-title" className="text-lg font-semibold flex-1">Record Payment</h2>
            <button type="button" onClick={onClose} className="text-sm px-2 py-1 border rounded">Close</button>
          </div>
          <div className="p-4 space-y-4 overflow-auto">
            <div className="space-y-1">
              <label htmlFor="payment-amount" className="text-sm font-medium">Amount</label>
              <input
                id="payment-amount"
                data-testid="payment-amount-input"
                type="number"
                step="0.01"
                min={0}
                value={amount}
                onChange={e => setAmount(e.target.value)}
                onBlur={() => setTouched(true)}
                className="w-full border rounded px-3 py-2"
                placeholder="0.00"
                required
              />
              <div className="text-xs text-gray-500 flex gap-2 items-center">
                {amountError && <span className="text-red-600" role="alert">{amountError}</span>}
                {!amountError && overpayWarning && <span className="text-amber-600" role="alert">Exceeds amount due</span>}
              </div>
            </div>
            <div className="space-y-1">
              <label htmlFor="payment-method" className="text-sm font-medium">Method</label>
              <select
                id="payment-method"
                data-testid="payment-method-select"
                value={method}
                onChange={e => setMethod(e.target.value)}
                className="w-full border rounded px-3 py-2 bg-white"
              >
                <option value="cash">Cash</option>
                <option value="card">Card</option>
                <option value="ach">ACH</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div className="space-y-1">
              <label htmlFor="payment-date" className="text-sm font-medium">Date Received</label>
              <input
                id="payment-date"
                data-testid="payment-date-input"
                type="date"
                value={receivedDate}
                onChange={e => setReceivedDate(e.target.value)}
                className="w-full border rounded px-3 py-2"
                required
              />
            </div>
            <div className="space-y-1">
              <label htmlFor="payment-notes" className="text-sm font-medium flex justify-between">Notes<span className="text-xs font-normal text-gray-400">Optional</span></label>
              <textarea
                id="payment-notes"
                data-testid="payment-note-textarea"
                value={note}
                onChange={e => setNote(e.target.value)}
                rows={3}
                className="w-full border rounded px-3 py-2 resize-y"
                placeholder="Internal note (customer won't see this)"
              />
            </div>
            {errorMessage && (
              <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded p-2" role="alert" data-testid="payment-error">{errorMessage}</div>
            )}
            <div className="text-xs text-gray-500">
              Status: <span className="font-medium">{invoiceStatus}</span>. {invoiceStatus === 'PAID' ? 'Invoice already fully paid.' : invoiceStatus === 'VOID' ? 'Cannot record payments on a void invoice.' : ''}
            </div>
          </div>
          <div className="mt-auto border-t px-4 py-3 flex gap-3 justify-end">
            <button type="button" onClick={onClose} className="px-4 py-2 border rounded">Cancel</button>
            <button
              type="submit"
              disabled={disabled || invoiceStatus === 'PAID' || invoiceStatus === 'VOID'}
              className="px-4 py-2 rounded bg-blue-600 text-white disabled:opacity-60"
              data-testid="payment-submit-btn"
            >
              {submitting ? 'Saving…' : 'Record Payment'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default RecordPaymentModal;
