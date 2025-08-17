import React from 'react';
import { formatDetailedCurrency } from '../../services/revenueService';

interface LineItem {
  id: string;
  name: string;
  quantity: number;
  unit_price_cents: number;
  line_subtotal_cents: number;
  tax_cents: number;
  total_cents: number;
  description?: string;
}

interface Props { items: LineItem[]; }

const currency = (c: number) => formatDetailedCurrency(c / 100, true);

export function InvoiceLineItemsTable({ items }: Props) {
  return (
    <div className="border rounded-md overflow-x-auto">
      <table className="min-w-full text-sm">
        <thead className="bg-gray-50 text-xs uppercase tracking-wide">
          <tr>
            <th className="px-3 py-2 text-left">Item</th>
            <th className="px-3 py-2 text-right">Qty</th>
            <th className="px-3 py-2 text-right">Unit</th>
            <th className="px-3 py-2 text-right">Subtotal</th>
            <th className="px-3 py-2 text-right">Tax</th>
            <th className="px-3 py-2 text-right">Total</th>
          </tr>
        </thead>
        <tbody>
          {items.length === 0 && (
            <tr><td colSpan={6} className="px-3 py-4 text-center text-gray-500">No line items</td></tr>
          )}
          {items.map(li => (
            <tr key={li.id} className="border-t">
              <td className="px-3 py-2">
                <div className="font-medium">{li.name}</div>
                {li.description && <div className="text-xs text-gray-500">{li.description}</div>}
              </td>
              <td className="px-3 py-2 text-right">{li.quantity}</td>
              <td className="px-3 py-2 text-right">{currency(li.unit_price_cents)}</td>
              <td className="px-3 py-2 text-right">{currency(li.line_subtotal_cents)}</td>
              <td className="px-3 py-2 text-right">{currency(li.tax_cents)}</td>
              <td className="px-3 py-2 text-right">{currency(li.total_cents)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
