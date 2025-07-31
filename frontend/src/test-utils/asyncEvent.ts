/**
 * ACT-HELPER-001: AsyncEvent Helper
 * 
 * Provides a standardized way to wrap fireEvent calls in act() to prevent
 * React act() warnings and ensure consistent async handling across tests.
 */

/* eslint-disable testing-library/prefer-user-event */

import { act, fireEvent } from '@testing-library/react';

/**
 * Wraps a callback function with React's act() utility to ensure proper
 * async handling and prevent act() warnings when using fireEvent.
 * 
 * @param fn - The callback function to execute (can be sync or async)
 * @returns Promise that resolves when the act-wrapped function completes
 * 
 * @example
 * // Instead of:
 * await act(async () => {
 *   fireEvent.click(button);
 * });
 * 
 * // Use:
 * await asyncEvent(() => fireEvent.click(button));
 * 
 * @example
 * // Works with multiple fireEvent calls:
 * await asyncEvent(() => {
 *   fireEvent.change(input, { target: { value: 'test' } });
 *   fireEvent.click(button);
 * });
 */
export async function asyncEvent(fn: () => void | Promise<void>): Promise<void> {
  await act(async () => {
    await fn();
  });
}

/**
 * Alternative name for better semantic clarity when dealing with user interactions
 */
export const wrapUserAction = asyncEvent;

/**
 * Convenience wrapper specifically for fireEvent.click operations
 */
export async function asyncClick(element: Element): Promise<void> {
  await asyncEvent(() => fireEvent.click(element));
}

/**
 * Convenience wrapper specifically for fireEvent.change operations
 */
export async function asyncChange(element: Element, value: string): Promise<void> {
  await asyncEvent(() => fireEvent.change(element, { target: { value } }));
}

export default asyncEvent;
