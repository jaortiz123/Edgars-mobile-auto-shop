// Accessibility test helpers
import { screen } from '@testing-library/react';

/**
 * Wait for focus management to complete before running axe scans
 * This is particularly important for components with focus traps
 */
export async function waitForFocusManagement(timeoutMs = 200): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, timeoutMs));
}

/**
 * Wait for drawer animation and focus trap to settle
 */
export async function waitForDrawerOpen(timeoutMs = 300): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, timeoutMs));
}

/**
 * Helper to check if an element is focused
 */
export function isFocused(element: HTMLElement): boolean {
  return document.activeElement === element;
}

/**
 * Helper to simulate tab key press for focus trap testing
 */
export function simulateTabKey(shiftKey = false): void {
  const tabEvent = new KeyboardEvent('keydown', {
    key: 'Tab',
    code: 'Tab',
    keyCode: 9,
    shiftKey,
    bubbles: true,
    cancelable: true
  });

  document.activeElement?.dispatchEvent(tabEvent);
}

/**
 * Helper to simulate escape key for dialog closing
 */
export function simulateEscapeKey(): void {
  const escapeEvent = new KeyboardEvent('keydown', {
    key: 'Escape',
    code: 'Escape',
    keyCode: 27,
    bubbles: true,
    cancelable: true
  });

  document.activeElement?.dispatchEvent(escapeEvent);
}

/**
 * Comprehensive focused element finder
 */
export function getFocusedElement(): Element | null {
  return document.activeElement;
}

/**
 * Wait for specific element to be focused
 */
export async function waitForFocus(selector: string, timeoutMs = 1000): Promise<Element | null> {
  const startTime = Date.now();

  while (Date.now() - startTime < timeoutMs) {
    const element = document.querySelector(selector);
    if (element && document.activeElement === element) {
      return element;
    }
    await new Promise(resolve => setTimeout(resolve, 10));
  }

  return null;
}

/**
 * Helper to ensure drawer API calls are complete
 */
export async function waitForDrawerData(timeoutMs = 500): Promise<void> {
  // Wait for API call to complete and state to settle
  await new Promise(resolve => setTimeout(resolve, timeoutMs));
}
