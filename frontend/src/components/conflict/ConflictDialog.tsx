import React, { useMemo } from 'react';

// Generic diff entry
export interface DiffRow {
  field: string;
  label: string;
  localValue: unknown;
  remoteValue: unknown;
  changed: boolean;
}

export interface ConflictDialogProps<T extends Record<string, unknown>> {
  open: boolean;
  local: T | null; // the user's optimistic (possibly stale) object
  remote: T | null; // fresh server object
  /**
   * Optional explicit field list. If omitted, union of keys from local & remote is used.
   * Provide label + optional formatter to customize rendering.
   */
  fields?: Array<{ key: keyof T; label?: string; format?: (v: unknown, data: { local: T | null; remote: T | null }) => React.ReactNode }>;
  title?: string;
  description?: string;
  onDiscard: () => void; // Discard local edits & accept server version
  onOverwrite: () => void; // Force overwrite (retry mutation ignoring server changes)
  onClose: () => void; // Close dialog (no decision yet)
  /** Optional custom renderer for row; return a React element or null to fallback */
  renderRow?: (row: DiffRow) => React.ReactNode;
}

function formatValue(v: unknown): string {
  if (v == null || v === '') return '—';
  if (typeof v === 'string') return v;
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  try { return JSON.stringify(v); } catch { return String(v); }
}

export function ConflictDialog<T extends Record<string, unknown>>({
  open,
  local,
  remote,
  fields,
  title = 'Update Conflict',
  description = 'Your changes are based on out-of-date data. Review differences and choose how to proceed.',
  onDiscard,
  onOverwrite,
  onClose,
  renderRow,
}: ConflictDialogProps<T>) {
  const rows: DiffRow[] = useMemo(() => {
    if (!local && !remote) return [];
    const keyList: string[] = fields
      ? (fields.map(f => String(f.key)))
      : Array.from(new Set([...(local ? Object.keys(local) : []), ...(remote ? Object.keys(remote) : [])])).sort();
    return keyList.map(field => {
      const fieldDef = fields?.find(f => String(f.key) === field);
  const localValue = local ? (local as Record<string, unknown>)[field] : undefined;
  const remoteValue = remote ? (remote as Record<string, unknown>)[field] : undefined;
      const changed = JSON.stringify(localValue) !== JSON.stringify(remoteValue);
      return {
        field,
        label: fieldDef?.label || field.replace(/_/g, ' '),
        localValue: fieldDef?.format ? fieldDef.format(localValue, { local, remote }) : localValue,
        remoteValue: fieldDef?.format ? fieldDef.format(remoteValue, { local, remote }) : remoteValue,
        changed,
      } as DiffRow;
    }).filter(r => r.changed); // show only changed rows by default
  }, [local, remote, fields]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" role="dialog" aria-modal="true" aria-labelledby="conflict-dialog-title" data-testid="conflict-dialog">
      <div className="bg-white dark:bg-neutral-900 w-full max-w-2xl rounded shadow-lg border p-6 flex flex-col gap-4">
        <header className="space-y-1">
          <h2 id="conflict-dialog-title" className="text-lg font-semibold">{title}</h2>
          <p className="text-sm text-muted-foreground">{description}</p>
        </header>
        {rows.length === 0 ? (
          <div className="text-sm text-muted-foreground" data-testid="conflict-no-diff">No differing fields detected.</div>
        ) : (
          <div className="max-h-80 overflow-auto border rounded" data-testid="conflict-diff-table">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-xs uppercase tracking-wide">
                <tr>
                  <th className="text-left px-3 py-2 w-40">Field</th>
                  <th className="text-left px-3 py-2">Your change</th>
                  <th className="text-left px-3 py-2">Latest on server</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(r => {
                  const content = renderRow ? renderRow(r) : null;
                  if (content) return <React.Fragment key={r.field}>{content}</React.Fragment>;
                  return (
                    <tr key={r.field} data-testid={`conflict-diff-row-${r.field}`} className="border-t align-top">
                      <th scope="row" className="px-3 py-2 text-left font-medium whitespace-nowrap">{r.label}</th>
                      <td className="px-3 py-2 text-rose-700/90 dark:text-rose-400">
                        <DiffValue value={r.localValue} original={remote ? (remote as Record<string, unknown>)[r.field] : undefined} />
                      </td>
                      <td className="px-3 py-2 text-emerald-700/90 dark:text-emerald-400">
                        <DiffValue value={r.remoteValue} original={local ? (local as Record<string, unknown>)[r.field] : undefined} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <footer className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-2">
          <button type="button" onClick={onDiscard} className="px-3 py-2 rounded border" data-testid="conflict-discard-btn">Discard my changes</button>
          <button type="button" onClick={onOverwrite} className="px-3 py-2 rounded bg-blue-600 text-white" data-testid="conflict-overwrite-btn">Overwrite</button>
          <button type="button" onClick={onClose} className="ml-auto sm:ml-0 px-3 py-2 text-xs text-muted-foreground" aria-label="Close" data-testid="conflict-close-btn">Close</button>
        </footer>
      </div>
    </div>
  );
}

function DiffValue({ value }: { value: unknown; original?: unknown }) {
  if (React.isValidElement(value)) return value;
  return <span>{formatValue(value)}</span>;
}

export default ConflictDialog;
