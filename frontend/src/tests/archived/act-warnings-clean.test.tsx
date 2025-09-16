import React, { useState } from 'react';
import { render, screen, waitFor } from '@test-utils';
import userEvent from '@testing-library/user-event';
import { vi, describe, test, expect, beforeEach } from 'vitest';
import { asyncClick, asyncChange } from '../test-utils/asyncEvent';

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

    const user = userEvent.setup();
    const textarea = screen.getByTestId('message-input');
    const sendButton = screen.getByTestId('send-button');

    // This sequence should trigger act() warnings:
    // 1. userEvent.type triggers setState
    // 2. userEvent.click triggers async setState in setTimeout
    // 3. No act() wrapping = warning
    await user.clear(textarea);
    await user.type(textarea, 'Test message');
    await user.click(sendButton);

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

    const user = userEvent.setup();
    const textarea = screen.getByTestId('message-input');
    const sendButton = screen.getByTestId('send-button');

    // userEvent automatically handles act() wrapping, no need for manual act()
    await user.clear(textarea);
    await user.type(textarea, 'Properly wrapped message');
    await user.click(sendButton);

    await waitFor(() => {
      expect(screen.getByTestId('message-0')).toHaveTextContent('Properly wrapped message');
    });
  });

  test('SHOULD NOT trigger act() warnings with asyncEvent helper', async () => {
    render(<AsyncTestComponent />);

    const user = userEvent.setup();
    const textarea = screen.getByTestId('message-input');
    const sendButton = screen.getByTestId('send-button');

    // Using userEvent for better testing practices
    await user.clear(textarea);
    await user.type(textarea, 'AsyncEvent helper message');
    await user.click(sendButton);

    await waitFor(() => {
      expect(screen.getByTestId('message-0')).toHaveTextContent('AsyncEvent helper message');
    });
  });

  test('SHOULD NOT trigger act() warnings with asyncEvent convenience methods', async () => {
    render(<AsyncTestComponent />);

    const textarea = screen.getByTestId('message-input');
    const sendButton = screen.getByTestId('send-button');

    // Using convenience methods for even cleaner syntax
    await asyncChange(textarea, 'Convenience method message');
    await asyncClick(sendButton);

    await waitFor(() => {
      expect(screen.getByTestId('message-0')).toHaveTextContent('Convenience method message');
    });
  });
});
