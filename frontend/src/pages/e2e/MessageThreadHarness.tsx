import React from 'react';
import MessageThread from '@/components/admin/MessageThread';

// E2E harness to isolate MessageThread for template send tests.
// Mounted at /e2e/message-thread/:appointmentId (DEV only).
export default function MessageThreadHarness() {
  const apptId = window.location.pathname.split('/').pop() || 'e2e-appt-1';
  return (
    <div className="p-4" data-testid="message-thread-harness">
      <h1 className="text-lg font-semibold mb-2">E2E Message Thread Harness</h1>
      <MessageThread appointmentId={apptId} drawerOpen={true} />
    </div>
  );
}
