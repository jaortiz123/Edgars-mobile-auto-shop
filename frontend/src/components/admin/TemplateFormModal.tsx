import React, { useEffect, useMemo, useState } from 'react';
import { createMessageTemplate, updateMessageTemplate, MessageTemplateRecord } from '@/lib/api';
import { extractTemplateVariables } from '@/lib/messageTemplates';

export interface TemplateFormValues {
  slug: string;
  label: string;
  channel: 'sms' | 'email';
  category: string;
  body: string;
  is_active?: boolean;
}

interface TemplateFormModalProps {
  mode: 'create' | 'edit';
  open: boolean;
  onClose: () => void;
  onSaved: (tpl: MessageTemplateRecord) => void;
  initial?: MessageTemplateRecord | null;
}

const defaultValues: TemplateFormValues = {
  slug: '',
  label: '',
  channel: 'sms',
  category: '',
  body: '',
  is_active: true,
};

export const TemplateFormModal: React.FC<TemplateFormModalProps> = ({ mode, open, onClose, onSaved, initial }) => {
  const [values, setValues] = useState<TemplateFormValues>(defaultValues);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      if (mode === 'edit' && initial) {
        setValues({
          slug: initial.slug,
          label: initial.label,
            channel: initial.channel,
          category: initial.category || '',
          body: initial.body,
          is_active: initial.is_active,
        });
      } else {
        setValues(defaultValues);
      }
      setError(null);
      setSaving(false);
    }
  }, [open, mode, initial]);

  const variables = useMemo(() => extractTemplateVariables(values.body), [values.body]);

  if (!open) return null;

  const setField = <K extends keyof TemplateFormValues>(k: K, v: TemplateFormValues[K]) => {
    setValues(prev => ({ ...prev, [k]: v }));
  };

  const validate = (): string | null => {
    if (mode === 'create') {
      if (!values.slug.trim()) return 'Slug is required';
      if (!/^[a-z0-9_-]+$/.test(values.slug)) return 'Slug must be lowercase alphanumeric, underscore or dash';
    }
    if (!values.label.trim()) return 'Label is required';
    if (!values.body.trim()) return 'Body is required';
    if (!['sms','email'].includes(values.channel)) return 'Channel invalid';
    if (values.body.length > 5000) return 'Body too long (max 5000)';
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const vErr = validate();
    if (vErr) { setError(vErr); return; }
    try {
      setSaving(true);
      setError(null);
      let saved: MessageTemplateRecord;
      if (mode === 'create') {
        saved = await createMessageTemplate({
          slug: values.slug.trim(),
          label: values.label.trim(),
          channel: values.channel,
          category: values.category.trim() || undefined,
          body: values.body,
        });
      } else if (initial) {
        saved = await updateMessageTemplate(initial.slug, {
          label: values.label.trim(),
          channel: values.channel,
          category: values.category.trim() || undefined,
          body: values.body,
          is_active: values.is_active,
        });
      } else {
        throw new Error('Missing template for edit');
      }
      onSaved(saved);
      onClose();
    } catch (err) {
      setError((err as Error).message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 p-4 overflow-y-auto" role="dialog" aria-modal="true">
      <div className="bg-white rounded shadow-xl w-full max-w-2xl animate-fade-in">
  <form noValidate onSubmit={handleSubmit} className="flex flex-col h-full max-h-[90vh]">
          <div className="px-4 py-3 border-b flex items-center justify-between">
            <h2 className="text-lg font-semibold">{mode === 'create' ? 'Create Template' : 'Edit Template'}</h2>
            <button type="button" onClick={onClose} className="text-gray-500 hover:text-gray-800" aria-label="Close">✕</button>
          </div>
          <div className="p-4 space-y-4 overflow-y-auto">
            {error && <div className="text-sm text-red-600" data-testid="template-form-error">{error}</div>}
            {mode === 'create' && (
              <div>
                <label htmlFor="tpl-slug" className="block text-xs font-medium text-gray-600 mb-1">Slug<span className="text-red-500">*</span></label>
                <input
                  id="tpl-slug"
                  value={values.slug}
                  onChange={e => setField('slug', e.target.value)}
                  className="w-full border rounded px-2 py-1 text-sm font-mono"
                  placeholder="vehicle_ready_sms"
                  maxLength={64}
                  required
                />
              </div>
            )}
            <div>
              <label htmlFor="tpl-label" className="block text-xs font-medium text-gray-600 mb-1">Label<span className="text-red-500">*</span></label>
              <input
                id="tpl-label"
                value={values.label}
                onChange={e => setField('label', e.target.value)}
                className="w-full border rounded px-2 py-1 text-sm"
                placeholder="Vehicle Ready (SMS)"
                required
              />
            </div>
            <div className="flex gap-4 flex-wrap">
              <div className="flex-1 min-w-[150px]">
                <label htmlFor="tpl-channel" className="block text-xs font-medium text-gray-600 mb-1">Channel<span className="text-red-500">*</span></label>
                <select
                  id="tpl-channel"
                  value={values.channel}
                  onChange={e => setField('channel', e.target.value as 'sms' | 'email')}
                  className="w-full border rounded px-2 py-1 text-sm"
                  aria-label="Channel"
                  title="Channel"
                  required
                >
                  <option value="sms">SMS</option>
                  <option value="email">Email</option>
                </select>
              </div>
              <div className="flex-1 min-w-[150px]">
                <label htmlFor="tpl-category" className="block text-xs font-medium text-gray-600 mb-1">Category</label>
                <input
                  id="tpl-category"
                  value={values.category}
                  onChange={e => setField('category', e.target.value)}
                  className="w-full border rounded px-2 py-1 text-sm"
                  placeholder="Reminders"
                />
              </div>
              {mode === 'edit' && (
                <div className="flex items-center gap-2 mt-5">
                  <input
                    type="checkbox"
                    checked={values.is_active !== false}
                    onChange={e => setField('is_active', e.target.checked)}
                    id="tpl-active"
                  />
                  <label htmlFor="tpl-active" className="text-xs text-gray-700">Active</label>
                </div>
              )}
            </div>
            <div>
              <label htmlFor="tpl-body" className="block text-xs font-medium text-gray-600 mb-1">Body<span className="text-red-500">*</span></label>
              <textarea
                id="tpl-body"
                value={values.body}
                onChange={e => setField('body', e.target.value)}
                className="w-full border rounded px-2 py-2 text-sm font-mono min-h-[140px]"
                placeholder="Hi {{customer.name}}, your vehicle is ready!"
                required
              />
              <div className="mt-1 text-[10px] text-gray-500 flex justify-between">
                <span>{values.body.length} chars</span>
                <span>{variables.length} vars</span>
              </div>
            </div>
            {variables.length > 0 && (
              <div className="bg-gray-50 border rounded p-2">
                <div className="text-[10px] font-semibold text-gray-600 mb-1">Extracted Variables</div>
                <div className="flex flex-wrap gap-1">
                  {variables.map(v => (
                    <span key={v} className="text-[10px] bg-blue-100 text-blue-800 px-2 py-0.5 rounded">{v}</span>
                  ))}
                </div>
              </div>
            )}
            <div className="bg-gray-50 border rounded p-2">
              <div className="text-[10px] font-semibold text-gray-600 mb-1">Preview (raw)</div>
              <div className="whitespace-pre-wrap text-xs text-gray-800 max-h-40 overflow-y-auto">
                {values.body || <span className="text-gray-400">(Empty)</span>}
              </div>
            </div>
          </div>
          <div className="px-4 py-3 border-t bg-gray-50 flex justify-between items-center">
            <div className="text-xs text-gray-500">Fields marked * required</div>
            <div className="flex gap-2">
              <button type="button" onClick={onClose} className="px-3 py-1.5 text-sm rounded border bg-white hover:bg-gray-100">Cancel</button>
              <button
                type="submit"
                disabled={saving}
                className="px-4 py-1.5 text-sm rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
              >{saving ? 'Saving...' : 'Save'}</button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

export default TemplateFormModal;
