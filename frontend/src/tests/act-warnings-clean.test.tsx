import React, { useState } from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, test, expect, beforeEach } from 'vitest';

// Simple test component that simulates async behavior to trigger act() warnings
const AsyncTestComponent: React.FC = () => {
  const [messages, setMessages] = useState<string[]>([]);
  const [inputValue, setInputValue] = useState('');

  const handleSendMessage = () => {
    // Simulate async message sending that updates state
    setTimeout(() => {
      setMessages(prev => [...prev, inputValue]);
      setInputValue('');
    }, 10);
  };

  return (
    <div>
      <div data-testid="messages">
        {messages.map((msg, idx) => (
          <div key={idx} data-testid={`message-${idx}`}>{msg}</div>
        ))}
      </div>
      <textarea
        data-testid="message-input"
        value={inputValue}
        onChange={(e) => setInputValue(e.target.value)}
        placeholder="Type a message"
      />
      <button
        data-testid="send-button"
        onClick={handleSendMessage}
        disabled={!inputValue.trim()}
      >
        Send
      </button>
    </div>
  );
};

describe('P1-T-005: React Act() Warning Detection Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('SHOULD trigger act() warnings with unwrapped fireEvent.change + fireEvent.click', async () => {
    render(<AsyncTestComponent />);

    const textarea = screen.getByTestId('message-input');
    const sendButton = screen.getByTestId('send-button');

    // This sequence should trigger act() warnings:
    // 1. fireEvent.change triggers setState
    // 2. fireEvent.click triggers async setState in setTimeout
    // 3. No act() wrapping = warning
    fireEvent.change(textarea, { target: { value: 'Test message' } });
    fireEvent.click(sendButton);

    // Wait for async state update
    await waitFor(() => {
      expect(screen.getByTestId('message-0')).toHaveTextContent('Test message');
    });
  });

  test('SHOULD NOT trigger act() warnings with userEvent', async () => {
    const user = userEvent.setup();
    render(<AsyncTestComponent />);

    const textarea = screen.getByTestId('message-input');
    const sendButton = screen.getByTestId('send-button');

    // userEvent automatically handles act() wrapping
    await user.type(textarea, 'Test message with userEvent');
    await user.click(sendButton);

    await waitFor(() => {
      expect(screen.getByTestId('message-0')).toHaveTextContent('Test message with userEvent');
    });
  });

  test('SHOULD NOT trigger act() warnings with properly wrapped fireEvent', async () => {
    render(<AsyncTestComponent />);

    const textarea = screen.getByTestId('message-input');
    const sendButton = screen.getByTestId('send-button');

    // Properly wrapped with act() should not trigger warnings
    await act(async () => {
      fireEvent.change(textarea, { target: { value: 'Properly wrapped message' } });
    });
    
    await act(async () => {
      fireEvent.click(sendButton);
    });

    await waitFor(() => {
      expect(screen.getByTestId('message-0')).toHaveTextContent('Properly wrapped message');
    });
  });
});
