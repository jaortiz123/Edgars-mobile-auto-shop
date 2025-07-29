import React, { useState, useEffect, useRef, useCallback } from 'react';
import { toast } from '@/lib/toast';
import * as api from '@/lib/api';
import type { Message, MessageChannel, MessageStatus } from '@/types/models';

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
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const pollingRef = useRef<NodeJS.Timeout | undefined>(undefined);

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
                      <span className={`${getStatusColor(message.status)}`}>
                        {getStatusIcon(message.status)}
                      </span>
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
        <div className="flex gap-2 mb-2">
          <select
            value={channel}
            onChange={(e) => setChannel(e.target.value as MessageChannel)}
            className="text-sm border rounded px-2 py-1"
            aria-label="Message channel"
          >
            <option value="sms">SMS</option>
            <option value="email">Email</option>
          </select>
        </div>
        
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
