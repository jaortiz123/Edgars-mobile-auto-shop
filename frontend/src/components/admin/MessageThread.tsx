import React, { useState, useEffect, useRef, useCallback } from 'react';
import { toast } from '@/lib/toast';
import * as api from '@/lib/api';
import type { Message, MessageChannel, MessageStatus } from '@/types/models';
import { applyTemplate, buildTemplateContext, extractTemplateVariables } from '@/lib/messageTemplates';
import { loadTemplatesWithFallback, MessageTemplateRecord, createAppointmentMessageWithTemplate, handleApiError, getDrawer } from '@/lib/api';

interface MessageThreadProps {
  appointmentId: string;
  drawerOpen: boolean;
}

export default function MessageThread({ appointmentId, drawerOpen }: MessageThreadProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [newMessage, setNewMessage] = useState('');
  const [channel, setChannel] = useState<MessageChannel>('sms');
  const [showTemplates, setShowTemplates] = useState(false);
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [bundle, setBundle] = useState<Record<string, unknown> | null>(null);
  const [previewTemplateId, setPreviewTemplateId] = useState<string | null>(null);
  const [optimistic, setOptimistic] = useState<Record<string, { state: 'sending' | 'failed'; templateId?: string }>>({});
  const [templates, setTemplates] = useState<MessageTemplateRecord[]>([]);
  const [templatesLoading, setTemplatesLoading] = useState(false);
  const [templatesError, setTemplatesError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const pollingRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // Load messages function
  const loadMessages = useCallback(async () => {
    if (!appointmentId) return;
    
    try {
      setLoading(true);
      const fetchedMessages = await api.getAppointmentMessages(appointmentId);
      setMessages(fetchedMessages);
    } catch (error) {
      console.error('Failed to load messages:', error);
      toast.error('Failed to load messages');
    } finally {
      setLoading(false);
    }
  }, [appointmentId]);

  // Load messages on component mount and appointment change
  useEffect(() => {
    if (appointmentId) {
      loadMessages();
    }
  }, [appointmentId, loadMessages]);

  // Load drawer bundle for context (appointment + customer + vehicle)
  useEffect(() => {
    let active = true;
    if (appointmentId) {
  getDrawer(appointmentId).then(d => { if (active) setBundle(d as unknown as Record<string, unknown>); }).catch(()=>{});
    }
    return () => { active = false; };
  }, [appointmentId]);

  // Auto-polling when drawer is open
  useEffect(() => {
    if (drawerOpen && appointmentId) {
      // Start polling every 10 seconds
      pollingRef.current = setInterval(() => {
        loadMessages();
      }, 10000);
    } else {
      // Clear polling when drawer is closed
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = undefined;
      }
    }

    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
      }
    };
  }, [drawerOpen, appointmentId, loadMessages]);

  // Scroll to bottom when messages change
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    if (messagesEndRef.current?.scrollIntoView) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const handleSendMessage = async () => {
    if (!newMessage.trim() || sending) return;

    try {
      setSending(true);
      const response = await api.createAppointmentMessage(appointmentId, {
        channel,
        body: newMessage.trim()
      });

      // Create optimistic message for immediate UI update
      const optimisticMessage: Message = {
        id: response.id,
        appointment_id: appointmentId,
        channel,
        direction: 'out',
        body: newMessage.trim(),
        status: response.status,
        sent_at: new Date().toISOString()
      };

      setMessages(prev => [optimisticMessage, ...prev]);
      setNewMessage('');
      toast.success('Message sent');

      // Refetch messages after a short delay to get updated status
      setTimeout(() => {
        loadMessages();
      }, 1000);
    } catch (error) {
      console.error('Failed to send message:', error);
      const errorMessage = api.handleApiError(error, 'Failed to send message');
      toast.error(errorMessage);
    } finally {
      setSending(false);
    }
  };

  const sendResolvedTemplate = async (templateId: string) => {
    const t = templates.find(mt => mt.id === templateId || mt.slug === templateId);
    if (!t) return;
    const ctx = buildTemplateContext(bundle || {});
    const tempShape = { id: t.slug, label: t.label, channel: t.channel, category: t.category || undefined, body: t.body };
    const resolved = applyTemplate(tempShape, ctx);
    const variables = extractTemplateVariables(t.body);
    const tempId = `optimistic-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const optimisticMessage: Message = {
      id: tempId,
      appointment_id: appointmentId,
      channel,
      direction: 'out',
      body: resolved,
      status: 'sending',
      sent_at: new Date().toISOString()
    };
    setMessages(prev => [optimisticMessage, ...prev]);
    setOptimistic(m => ({ ...m, [tempId]: { state: 'sending', templateId } }));
    setShowTemplates(false);
    setPreviewTemplateId(null);
    try {
      const resp = await createAppointmentMessageWithTemplate(appointmentId, {
        channel,
        body: resolved,
        template_id: t.slug,
        variables_used: variables
      });
      setMessages(prev => prev.map(msg => msg.id === tempId ? { ...msg, id: resp.id, status: resp.status } : msg));
      setOptimistic(m => { const copy = { ...m }; delete copy[tempId]; return copy; });
      toast.success('Message sent');
      setTimeout(() => loadMessages(), 800);
    } catch (e) {
      setOptimistic(m => ({ ...m, [tempId]: { state: 'failed', templateId } }));
      toast.error(handleApiError ? handleApiError(e, 'Failed to send message') : 'Failed to send');
    }
  };

  const retrySend = async (tempId: string) => {
    const entry = optimistic[tempId];
    if (!entry) return;
    const target = messages.find(m => m.id === tempId);
    if (!target) return;
    setOptimistic(m => ({ ...m, [tempId]: { ...m[tempId], state: 'sending' } }));
    try {
      const resp = await createAppointmentMessageWithTemplate(appointmentId, {
        channel: target.channel,
        body: target.body,
        template_id: entry.templateId || undefined,
        variables_used: []
      });
      setMessages(prev => prev.map(msg => msg.id === tempId ? { ...msg, id: resp.id, status: resp.status } : msg));
      setOptimistic(m => { const copy = { ...m }; delete copy[tempId]; return copy; });
      toast.success('Message sent');
      setTimeout(() => loadMessages(), 800);
    } catch (e) {
      setOptimistic(m => ({ ...m, [tempId]: { ...m[tempId], state: 'failed' } }));
      toast.error(handleApiError ? handleApiError(e, 'Retry failed') : 'Retry failed');
    }
  };

  // Load templates (dynamic backend + fallback)
  useEffect(() => {
    let cancelled = false;
    setTemplatesLoading(true);
    loadTemplatesWithFallback()
      .then(list => { if (!cancelled) { setTemplates(list); } })
      .catch(err => { if (!cancelled) { setTemplatesError((err as Error).message || 'Failed to load templates'); } })
      .finally(() => { if (!cancelled) setTemplatesLoading(false); });
    return () => { cancelled = true; };
  }, []);

  // Template handling
  const categories = React.useMemo(() => {
    const set = new Set<string>();
    templates.forEach(t => { if (t.category) set.add(t.category); });
    return Array.from(set.values()).sort();
  }, [templates]);

  const templatesForChannel = React.useMemo(() => {
    // Reuse existing filterTemplates by adapting shape if needed
    // Simplest: perform filtering inline for dynamic records
    let list = templates.filter(t => t.channel === channel);
    if (filterCategory && filterCategory !== 'all') list = list.filter(t => t.category === filterCategory);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(t =>
        t.label.toLowerCase().includes(q) ||
        t.body.toLowerCase().includes(q) ||
        (t.category || '').toLowerCase().includes(q)
      );
    }
    return list;
  }, [templates, channel, filterCategory, search]);

  const handleInsertTemplate = (id: string) => {
    const t = templates.find(mt => mt.id === id || mt.slug === id);
    if (!t) return;
    const ctx = buildTemplateContext(bundle || {});
    const applied = applyTemplate({ id: t.slug, label: t.label, channel: t.channel, category: t.category || undefined, body: t.body }, ctx);
    setNewMessage(prev => (prev ? prev + '\n\n' + applied : applied));
    setShowTemplates(false);
    setPreviewTemplateId(null);
    setTimeout(() => textareaRef.current?.focus(), 0);
  };

  const handleDeleteMessage = async (messageId: string) => {
    if (!confirm('Are you sure you want to delete this message?')) return;

    try {
      await api.deleteAppointmentMessage(appointmentId, messageId);
      setMessages(prev => prev.filter(msg => msg.id !== messageId));
      toast.success('Message deleted');
    } catch (error) {
      console.error('Failed to delete message:', error);
      const errorMessage = api.handleApiError(error, 'Failed to delete message');
      toast.error(errorMessage);
    }
  };

  const getStatusIcon = (status: MessageStatus) => {
    switch (status) {
      case 'sending':
        return '⏳';
      case 'delivered':
        return '✓';
      case 'failed':
        return '❌';
      default:
        return '?';
    }
  };

  const getStatusColor = (status: MessageStatus) => {
    switch (status) {
      case 'sending':
        return 'text-yellow-600';
      case 'delivered':
        return 'text-green-600';
      case 'failed':
        return 'text-red-600';
      default:
        return 'text-gray-600';
    }
  };

  const formatTime = (sentAt?: string | null) => {
    if (!sentAt) return '';
    try {
      return new Date(sentAt).toLocaleString();
    } catch {
      return '';
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  if (loading && messages.length === 0) {
    return (
      <div className="flex items-center justify-center h-32">
        <div className="text-gray-500">Loading messages...</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-96">
      {/* Messages List */}
      <div
        className="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50"
        role="log"
        aria-live="polite"
        aria-label="Message thread"
      >
        {messages.length === 0 ? (
          <div className="text-center text-gray-500 py-8">
            <div className="text-2xl mb-2">💬</div>
            <div className="text-sm">No messages yet</div>
            <div className="text-xs text-gray-400">Send your first message below</div>
          </div>
        ) : (
          <>
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex ${message.direction === 'out' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-xs lg:max-w-md px-3 py-2 rounded-lg ${
                    message.direction === 'out'
                      ? 'bg-blue-500 text-white'
                      : 'bg-white text-gray-900 border'
                  }`}
                >
                  <div className="text-sm">{message.body}</div>
                  <div className="flex items-center justify-between mt-1 text-xs opacity-75">
                    <span>{formatTime(message.sent_at)}</span>
                    <div className="flex items-center gap-1">
                      <span
                        className={`${getStatusColor(message.status)}`}
                        data-testid={`message-status-${message.id}`}
                        data-state={optimistic[message.id]?.state || message.status}
                      >
                        {getStatusIcon(message.status)}
                      </span>
                      {optimistic[message.id]?.state === 'failed' && (
                        <button
                          onClick={() => retrySend(message.id)}
                          className="text-red-200 underline text-[10px] ml-1"
                          data-testid={`retry-${message.id}`}
                        >Retry</button>
                      )}
                      <span className="capitalize">{message.channel}</span>
                      {message.direction === 'out' && (
                        <button
                          onClick={() => handleDeleteMessage(message.id)}
                          className="ml-1 text-red-300 hover:text-red-100"
                          title="Delete message"
                          aria-label="Delete message"
                        >
                          🗑️
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {/* Message Composer */}
      <div className="border-t bg-white p-4">
  <div className="flex items-center justify-between mb-2 gap-2 flex-wrap">
          <div className="flex gap-2 items-center">
            <select
              value={channel}
              onChange={(e) => setChannel(e.target.value as MessageChannel)}
              className="text-sm border rounded px-2 py-1"
              aria-label="Message channel"
            >
              <option value="sms">SMS</option>
              <option value="email">Email</option>
            </select>
            <button
              type="button"
              data-testid="template-picker-button"
              onClick={() => setShowTemplates(s => !s)}
              className="text-sm px-2 py-1 border rounded hover:bg-gray-50"
              aria-controls="template-panel"
            >
              {showTemplates ? 'Hide Templates' : 'Templates'}
            </button>
          </div>
          {showTemplates && (
            <div className="flex gap-2 items-center" data-testid="template-controls">
              {categories.length > 0 && (
                <select
                  value={filterCategory}
                  onChange={(e) => setFilterCategory(e.target.value)}
                  className="text-xs border rounded px-2 py-1"
                  aria-label="Template category filter"
                >
                  <option value="all">All Categories</option>
                  {categories.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              )}
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search templates..."
                className="text-xs border rounded px-2 py-1"
                aria-label="Search templates"
                data-testid="template-search-input"
              />
              {search && (
                <button
                  type="button"
                  className="text-[10px] uppercase tracking-wide text-gray-500 hover:text-gray-700"
                  onClick={() => setSearch('')}
                  data-testid="template-search-clear"
                  aria-label="Clear template search"
                >
                  Clear
                </button>
              )}
            </div>
          )}
        </div>

        {showTemplates && templatesLoading && (
          <div className="text-xs text-gray-500 mb-2">Loading templates...</div>
        )}
        {showTemplates && templatesError && !templatesLoading && (
          <div className="text-xs text-red-600 mb-2">{templatesError}</div>
        )}
        {showTemplates && (
          <div id="template-panel" className="mb-3 max-h-40 overflow-y-auto border rounded p-2 bg-gray-50 space-y-1" data-testid="template-panel">
            {templatesForChannel.length === 0 && !templatesLoading && (
              <div className="text-xs text-gray-500">No templates for channel</div>
            )}
            {templatesForChannel.map(t => {
              const isPreview = previewTemplateId === t.id || previewTemplateId === t.slug;
              const ctx = buildTemplateContext(bundle || {});
              const resolved = applyTemplate({ id: t.slug, label: t.label, channel: t.channel, category: t.category || undefined, body: t.body }, ctx, { missingTag: p => `[${p}]` });
              return (
                <div key={t.id} className={`border rounded ${isPreview ? 'bg-white' : 'bg-gray-100'} p-1`}>
                  <button
                    type="button"
                    onClick={() => setPreviewTemplateId(prev => prev === t.id ? null : t.id)}
                    className="w-full text-left text-xs px-2 py-1 rounded hover:bg-white"
                    data-testid={`template-option-${t.id}`}
                  >
                    <div className="flex justify-between items-center">
                      <div>
                        <div className="font-medium">{t.label}</div>
                        {t.category && <div className="text-[10px] uppercase tracking-wide text-gray-500">{t.category}</div>}
                      </div>
                      <div className="text-[10px] text-blue-600 underline">{isPreview ? 'Hide' : 'Preview'}</div>
                    </div>
                    {!isPreview && <div className="line-clamp-2 text-gray-600">{t.body}</div>}
                    {isPreview && (
                      <div className="mt-1 text-gray-700 whitespace-pre-wrap">
                        {resolved}
                        <div className="mt-1 flex gap-2">
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); handleInsertTemplate(t.id); }}
                            className="text-[10px] px-2 py-0.5 rounded bg-gray-300 text-gray-800 hover:bg-gray-200"
                            data-testid={`template-insert-${t.id}`}
                          >Insert</button>
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); sendResolvedTemplate(t.id); }}
                            className="text-[10px] px-2 py-0.5 rounded bg-green-600 text-white hover:bg-green-700"
                            data-testid={`template-send-${t.id}`}
                          >Insert & Send</button>
                        </div>
                      </div>
                    )}
                  </button>
                </div>
              );
            })}
          </div>
        )}
        
        <div className="flex gap-2">
          <textarea
            ref={textareaRef}
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type your message..."
            className="flex-1 border rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
            rows={2}
            maxLength={1000}
            aria-label="New message"
          />
          <button
            onClick={handleSendMessage}
            disabled={!newMessage.trim() || sending}
            className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
            aria-label="Send message"
          >
            {sending ? 'Sending...' : 'Send'}
          </button>
        </div>
        
        <div className="text-xs text-gray-500 mt-1">
          Press Enter to send, Shift+Enter for new line
        </div>
      </div>
    </div>
  );
}
