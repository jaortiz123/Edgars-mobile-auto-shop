import { useEffect, useRef } from 'react';

/**
 * Custom hook that creates a focus trap within a container element.
 * Ensures keyboard navigation stays within the modal/dialog.
 */
export function useFocusTrap(isActive: boolean) {
  const containerRef = useRef<HTMLElement | null>(null);
  const lastFocusedElement = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!isActive) return;

    // Store the currently focused element
    lastFocusedElement.current = document.activeElement as HTMLElement;

    const container = containerRef.current;
    if (!container) return;

    // Get all focusable elements within the container
    const getFocusableElements = (): HTMLElement[] => {
      const selector = [
        'button:not([disabled])',
        'input:not([disabled])',
        'textarea:not([disabled])',
        'select:not([disabled])',
        'a[href]',
        '[tabindex]:not([tabindex="-1"])',
        '[role="button"]:not([disabled])',
        '[role="tab"]:not([disabled])'
      ].join(', ');

      return Array.from(container.querySelectorAll(selector)) as HTMLElement[];
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Tab') return;

      const focusableElements = getFocusableElements();
      if (focusableElements.length === 0) return;

      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];

      if (event.shiftKey) {
        // Shift + Tab
        if (document.activeElement === firstElement) {
          event.preventDefault();
          lastElement.focus();
        }
      } else {
        // Tab
        if (document.activeElement === lastElement) {
          event.preventDefault();
          firstElement.focus();
        }
      }
    };

    // Add event listener
    document.addEventListener('keydown', handleKeyDown);

    // Focus the first element when trap activates
    const focusableElements = getFocusableElements();
    if (focusableElements.length > 0) {
      // Small delay to ensure the dialog is fully rendered
      setTimeout(() => {
        focusableElements[0].focus();
      }, 100);
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown);

      // Restore focus to the previously focused element
      if (lastFocusedElement.current && lastFocusedElement.current.focus) {
        lastFocusedElement.current.focus();
      }
    };
  }, [isActive]);

  return containerRef;
}

/**
 * Custom hook for implementing roving tabindex pattern.
 * Useful for lists where arrow keys navigate between items.
 */
export function useRovingTabindex(
  items: Array<{ id: string; element?: HTMLElement }>,
  isActive: boolean
) {
  const currentIndex = useRef<number>(0);
  const containerRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!isActive) return;

    const container = containerRef.current;
    if (!container) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;

      event.preventDefault();

      const focusableItems = items.map((item, index) => ({
        ...item,
        index,
        element: item.element || container.querySelector(`[data-roving-id="${item.id}"]`) as HTMLElement
      })).filter(item => item.element && !(item.element as HTMLButtonElement | HTMLInputElement).disabled);

      if (focusableItems.length === 0) return;

      let newIndex = currentIndex.current;

      switch (event.key) {
        case 'ArrowDown':
          newIndex = (currentIndex.current + 1) % focusableItems.length;
          break;
        case 'ArrowUp':
          newIndex = currentIndex.current === 0 ? focusableItems.length - 1 : currentIndex.current - 1;
          break;
        case 'Home':
          newIndex = 0;
          break;
        case 'End':
          newIndex = focusableItems.length - 1;
          break;
      }

      currentIndex.current = newIndex;
      const targetItem = focusableItems[newIndex];

      if (targetItem.element) {
        // Set tabindex appropriately
        focusableItems.forEach((item, idx) => {
          if (item.element) {
            item.element.tabIndex = idx === newIndex ? 0 : -1;
          }
        });

        targetItem.element.focus();
      }
    };

    const handleFocus = (event: FocusEvent) => {
      const target = event.target as HTMLElement;
      const itemId = target.getAttribute('data-roving-id');

      if (itemId) {
        const itemIndex = items.findIndex(item => item.id === itemId);
        if (itemIndex >= 0) {
          currentIndex.current = itemIndex;
        }
      }
    };

    container.addEventListener('keydown', handleKeyDown);
    container.addEventListener('focus', handleFocus, true);

    // Initialize tabindex values
    const focusableItems = items.map(item =>
      container.querySelector(`[data-roving-id="${item.id}"]`) as HTMLElement
    ).filter(Boolean);

    focusableItems.forEach((element, index) => {
      element.tabIndex = index === 0 ? 0 : -1;
    });

    return () => {
      container.removeEventListener('keydown', handleKeyDown);
      container.removeEventListener('focus', handleFocus, true);
    };
  }, [items, isActive]);

  return containerRef;
}

export default { useFocusTrap, useRovingTabindex };
