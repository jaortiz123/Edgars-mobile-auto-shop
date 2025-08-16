import React, { useEffect, useState, useMemo } from 'react';
import { fetchMessageTemplates, MessageTemplateRecord, deleteMessageTemplate, invalidateTemplatesCache } from '@/lib/api';
import TemplateFormModal from '@/components/admin/TemplateFormModal';
import { useAuth } from '@/hooks/useAuth';

// Phase 2 - Step 1: Scaffold for /admin/templates page
// Displays a basic list of templates (read-only for now). Later steps will add search/filter & CRUD modals.

const MessageTemplatesPage: React.FC = () => {
  const [templates, setTemplates] = useState<MessageTemplateRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [channelFilter, setChannelFilter] = useState<string>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [showInactive, setShowInactive] = useState(false);
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'create' | 'edit'>('create');
  const [editing, setEditing] = useState<MessageTemplateRecord | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const { user } = useAuth();

  // Derive categories from loaded templates (for filter dropdown)
  const categories = useMemo(() => {
    const set = new Set<string>();
    templates.forEach(t => { if (t.category) set.add(t.category); });
    return Array.from(set.values()).sort();
  }, [templates]);

  // Debounce query input
  useEffect(() => {
    const h = setTimeout(() => setDebouncedQuery(query.trim()), 300);
    return () => clearTimeout(h);
  }, [query]);

  // Fetch templates on mount & whenever filters change
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const params: { channel?: 'sms' | 'email'; category?: string; q?: string; includeInactive?: boolean } = {};
    if (channelFilter !== 'all') params.channel = channelFilter === 'sms' ? 'sms' : 'email';
    if (categoryFilter !== 'all') params.category = categoryFilter;
    if (debouncedQuery) params.q = debouncedQuery;
    if (showInactive) params.includeInactive = true;
    fetchMessageTemplates(params)
      .then(resp => { if (!cancelled) setTemplates(resp.message_templates); })
      .catch(err => { if (!cancelled) setError((err as Error).message || 'Failed to load templates'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [channelFilter, categoryFilter, debouncedQuery, showInactive]);

  const role: string | undefined = typeof user?.profile === 'object' && user?.profile && 'role' in user.profile
    ? (user.profile as Record<string, unknown>).role as string | undefined
    : undefined;

  const isOwner = role === 'Owner';

  const openCreate = () => { setModalMode('create'); setEditing(null); setModalOpen(true); };
  const openEdit = (tpl: MessageTemplateRecord) => { setModalMode('edit'); setEditing(tpl); setModalOpen(true); };
  const closeModal = () => { setModalOpen(false); };

  const refetch = () => {
    let cancelled = false;
    setLoading(true);
    const params: { channel?: 'sms' | 'email'; category?: string; q?: string; includeInactive?: boolean } = {};
    if (channelFilter !== 'all') params.channel = channelFilter === 'sms' ? 'sms' : 'email';
    if (categoryFilter !== 'all') params.category = categoryFilter;
    if (debouncedQuery) params.q = debouncedQuery;
    if (showInactive) params.includeInactive = true;
    fetchMessageTemplates(params)
      .then(resp => { if (!cancelled) setTemplates(resp.message_templates); })
      .catch(err => { if (!cancelled) setError((err as Error).message || 'Failed to load templates'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  };

  const handleSaved = () => {
    invalidateTemplatesCache();
    refetch();
  };

  const confirmDelete = async (tpl: MessageTemplateRecord) => {
    if (!isOwner) return;
    if (!confirm(`Delete template "${tpl.label}"? This can be undone by re-creating.`)) return;
    setDeletingId(tpl.id);
    setDeleteBusy(true);
    try {
      await deleteMessageTemplate(tpl.slug, { soft: true });
      invalidateTemplatesCache();
      refetch();
    } catch (e) {
      setError((e as Error).message || 'Delete failed');
    } finally {
      setDeleteBusy(false);
      setDeletingId(null);
    }
  };

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Message Templates</h1>
        <div className="flex items-center gap-3">
          {isOwner && (
            <button
              type="button"
              onClick={openCreate}
              className="text-sm px-3 py-1.5 rounded bg-blue-600 text-white hover:bg-blue-700"
              data-testid="create-template-btn"
            >Create New Template</button>
          )}
          <div className="text-sm text-gray-500">Role: {role || 'N/A'}</div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-end bg-gray-50 p-3 rounded border">
        <div className="flex flex-col">
          <label className="text-xs font-medium text-gray-600">Search</label>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search label/body/category..."
            className="border rounded px-2 py-1 text-sm w-56"
          />
        </div>
        <div className="flex flex-col">
          <label className="text-xs font-medium text-gray-600">Channel</label>
          <select
            value={channelFilter}
            onChange={(e) => setChannelFilter(e.target.value)}
            className="border rounded px-2 py-1 text-sm"
            aria-label="Channel filter"
            title="Channel filter"
          >
            <option value="all">All</option>
            <option value="sms">SMS</option>
            <option value="email">Email</option>
          </select>
        </div>
        <div className="flex flex-col">
          <label className="text-xs font-medium text-gray-600">Category</label>
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="border rounded px-2 py-1 text-sm"
            aria-label="Category filter"
            title="Category filter"
          >
            <option value="all">All</option>
            {categories.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
          <input
            type="checkbox"
            checked={showInactive}
            onChange={(e) => setShowInactive(e.target.checked)}
            className="h-4 w-4"
          />
          <span className="text-gray-700">Show inactive</span>
        </label>
        { (channelFilter !== 'all' || categoryFilter !== 'all' || debouncedQuery || showInactive) && (
          <button
            type="button"
            onClick={() => { setQuery(''); setChannelFilter('all'); setCategoryFilter('all'); setShowInactive(false); }}
            className="text-xs px-3 py-1 rounded bg-gray-200 hover:bg-gray-300"
          >Reset</button>
        ) }
      </div>

      {loading && <div className="text-sm text-gray-500">Loading templates...</div>}
      {error && <div className="text-sm text-red-600">{error}</div>}
      {!loading && !error && templates.length === 0 && (
        <div className="text-sm text-gray-500">No templates found.</div>
      )}
      {!loading && !error && templates.length > 0 && (
        <table className="min-w-full text-sm border" data-testid="templates-table">
          <thead className="bg-gray-100">
            <tr>
              <th className="px-2 py-1 text-left border">Label</th>
              <th className="px-2 py-1 text-left border">Slug</th>
              <th className="px-2 py-1 text-left border">Channel</th>
              <th className="px-2 py-1 text-left border">Category</th>
              <th className="px-2 py-1 text-left border">Active</th>
              <th className="px-2 py-1 text-left border">Variables</th>
              {isOwner && <th className="px-2 py-1 text-left border">Actions</th>}
            </tr>
          </thead>
          <tbody>
            {templates.map(t => (
              <tr key={t.id} className="hover:bg-gray-50">
                <td className="px-2 py-1 border font-medium">{t.label}</td>
                <td className="px-2 py-1 border font-mono text-xs">{t.slug}</td>
                <td className="px-2 py-1 border capitalize">{t.channel}</td>
                <td className="px-2 py-1 border">{t.category || <span className="text-gray-400">—</span>}</td>
                <td className="px-2 py-1 border">{t.is_active ? 'Yes' : 'No'}</td>
                <td className="px-2 py-1 border text-xs">{t.variables?.length ? t.variables.join(', ') : <span className="text-gray-400">—</span>}</td>
                {isOwner && (
                  <td className="px-2 py-1 border text-xs whitespace-nowrap space-x-2">
                    <button
                      type="button"
                      onClick={() => openEdit(t)}
                      className="px-2 py-0.5 rounded bg-gray-200 hover:bg-gray-300"
                      data-testid={`edit-${t.slug}`}
                    >Edit</button>
                    <button
                      type="button"
                      disabled={deleteBusy && deletingId === t.id}
                      onClick={() => confirmDelete(t)}
                      className="px-2 py-0.5 rounded bg-red-600 text-white hover:bg-red-700 disabled:opacity-50"
                      data-testid={`delete-${t.slug}`}
                    >{deleteBusy && deletingId === t.id ? 'Deleting...' : 'Delete'}</button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <TemplateFormModal
        mode={modalMode}
        open={modalOpen}
        onClose={closeModal}
        initial={editing}
        onSaved={handleSaved}
      />
    </div>
  );
};

export default MessageTemplatesPage;
