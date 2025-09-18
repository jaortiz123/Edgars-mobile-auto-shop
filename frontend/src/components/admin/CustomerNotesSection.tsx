import React, { useState, useRef } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Textarea } from '@/components/ui/Textarea';
import { Plus, MessageSquare, AlertTriangle, User, Calendar } from 'lucide-react';
import { dtLocal } from '@/utils/format';

interface CustomerNote {
  id: string;
  content: string;
  author: string;
  authorRole: string;
  createdAt: string;
  isAlert: boolean;
}

interface CustomerNotesSectionProps {
  customerId: string;
  notes?: CustomerNote[];
  onAddNote?: (content: string, isAlert?: boolean) => Promise<void>;
  isLoading?: boolean;
}

export function CustomerNotesSection({
  customerId,
  notes = [],
  onAddNote,
  isLoading = false
}: CustomerNotesSectionProps) {
  const [newNote, setNewNote] = useState('');
  const [isAlert, setIsAlert] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleAddNote = async () => {
    if (!newNote.trim() || !onAddNote) return;

    try {
      setIsSubmitting(true);
      await onAddNote(newNote.trim(), isAlert);
      setNewNote('');
      setIsAlert(false);
      // Focus back to textarea for rapid note-taking
      setTimeout(() => textareaRef.current?.focus(), 100);
    } catch (error) {
      console.error('Failed to add note:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Ctrl/Cmd + Enter to quick-add
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      handleAddNote();
    }
  };

  const formatNoteDate = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      const now = new Date();
      const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));
      
      if (diffInMinutes < 5) return 'Just now';
      if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
      if (diffInMinutes < 1440) return `${Math.floor(diffInMinutes / 60)}h ago`;
      
      return dtLocal(dateStr, { timeStyle: 'short', dateStyle: 'short' });
    } catch {
      return 'Unknown';
    }
  };

  const getRoleBadgeVariant = (role: string) => {
    switch (role.toLowerCase()) {
      case 'owner': return 'primary' as const;
      case 'advisor': return 'secondary' as const;
      case 'accountant': return 'success' as const;
      case 'technician': return 'outline' as const;
      default: return 'outline' as const;
    }
  };

  return (
    <Card className="mb-6" data-testid="customer-notes-section">
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center gap-2">
          <MessageSquare className="h-5 w-5" />
          Customer Notes & Interactions
        </CardTitle>
      </CardHeader>
      <CardContent>
        {/* Quick Note Input */}
        <div className="mb-6 bg-gray-50 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <div className="flex-1">
              <Textarea
                ref={textareaRef}
                value={newNote}
                onChange={(e) => setNewNote(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Add a quick note about this customer interaction... (Ctrl+Enter to save)"
                rows={3}
                maxLength={500}
                className="resize-none text-sm"
                data-testid="new-note-input"
              />
              <div className="flex justify-between items-center mt-2">
                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-1 text-xs text-gray-600 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={isAlert}
                      onChange={(e) => setIsAlert(e.target.checked)}
                      className="rounded"
                      data-testid="alert-checkbox"
                    />
                    Mark as Alert
                  </label>
                  <span className="text-xs text-gray-500">
                    {newNote.length}/500
                  </span>
                </div>
                <Button
                  onClick={handleAddNote}
                  disabled={!newNote.trim() || isSubmitting}
                  size="sm"
                  className="flex items-center gap-1"
                  data-testid="add-note-btn"
                >
                  <Plus className="h-3 w-3" />
                  {isSubmitting ? 'Adding...' : 'Add Note'}
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Notes List */}
        <div className="space-y-4">
          {isLoading ? (
            <div className="space-y-3" data-testid="notes-loading">
              {[1, 2, 3].map(i => (
                <div key={i} className="animate-pulse bg-gray-100 rounded-lg p-4 h-20"></div>
              ))}
            </div>
          ) : notes.length > 0 ? (
            notes.map((note) => (
              <div 
                key={note.id} 
                className={`border rounded-lg p-4 ${
                  note.isAlert 
                    ? 'border-orange-200 bg-orange-50' 
                    : 'border-gray-200 bg-white'
                }`}
                data-testid={`note-${note.id}`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      {note.isAlert && (
                        <AlertTriangle className="h-4 w-4 text-orange-500" />
                      )}
                      <div className="flex items-center gap-2">
                        <User className="h-3 w-3 text-gray-400" />
                        <span className="text-sm font-medium text-gray-900">
                          {note.author}
                        </span>
                        <Badge variant={getRoleBadgeVariant(note.authorRole)} className="text-xs">
                          {note.authorRole}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-1 text-xs text-gray-500">
                        <Calendar className="h-3 w-3" />
                        {formatNoteDate(note.createdAt)}
                      </div>
                    </div>
                    <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
                      {note.content}
                    </p>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="text-center py-8 text-gray-500" data-testid="no-notes">
              <MessageSquare className="h-8 w-8 mx-auto mb-3 text-gray-300" />
              <p className="text-sm font-medium">No notes yet</p>
              <p className="text-xs">Add the first interaction note above</p>
            </div>
          )}
        </div>

        {/* Show total count if more than visible */}
        {notes.length > 5 && (
          <div className="mt-4 pt-4 border-t border-gray-200 text-center">
            <Button variant="outline" size="sm" className="text-xs">
              View All Notes ({notes.length})
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}