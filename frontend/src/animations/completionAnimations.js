/**
 * Sprint 4A-T-001: Completion Animations
 * 
 * Fade-out + slide-down animations for completed appointment cards
 * with 300ms duration and proper DOM removal using onAnimationEnd
 */

export const COMPLETION_ANIMATION_DURATION = 300; // milliseconds

/**
 * Apply completion animation to a card element
 * @param {HTMLElement} cardElement - The card DOM element to animate
 * @param {Function} onComplete - Callback to execute after animation completes
 */
export function animateCardCompletion(cardElement, onComplete) {
  if (!cardElement) {
    console.warn('Card element not found for completion animation');
    if (onComplete) onComplete();
    return;
  }

  // Add completion animation class
  cardElement.classList.add('complete-animation');

  // Handle animation end
  const handleAnimationEnd = (event) => {
    if (event.target === cardElement && event.animationName === 'fadeOutSlideDown') {
      cardElement.removeEventListener('animationend', handleAnimationEnd);
      if (onComplete) onComplete();
    }
  };

  // Listen for animation end
  cardElement.addEventListener('animationend', handleAnimationEnd);

  // Fallback timeout in case animationend doesn't fire
  setTimeout(() => {
    cardElement.removeEventListener('animationend', handleAnimationEnd);
    if (onComplete) onComplete();
  }, COMPLETION_ANIMATION_DURATION + 100);
}

/**
 * Check if element supports CSS animations
 * @returns {boolean}
 */
export function supportsAnimations() {
  const testElement = document.createElement('div');
  const prefixes = ['animation', 'webkitAnimation', 'mozAnimation', 'msAnimation'];
  
  return prefixes.some(prefix => testElement.style[prefix] !== undefined);
}

/**
 * Respect user's reduced motion preference
 * @returns {boolean}
 */
export function shouldReduceMotion() {
  return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * Safe animation wrapper that respects accessibility preferences
 * @param {HTMLElement} cardElement - The card element to animate
 * @param {Function} onComplete - Callback for completion
 */
export function safeAnimateCompletion(cardElement, onComplete) {
  // Skip animation if user prefers reduced motion or browser doesn't support animations
  if (shouldReduceMotion() || !supportsAnimations()) {
    if (onComplete) onComplete();
    return;
  }

  animateCardCompletion(cardElement, onComplete);
}
