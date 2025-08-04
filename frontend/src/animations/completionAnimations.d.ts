/**
 * Sprint 4A-T-001: Completion Animations TypeScript Declarations
 */

export declare const COMPLETION_ANIMATION_DURATION: number;

export declare function animateCardCompletion(
  cardElement: HTMLElement | null,
  onComplete?: () => void
): void;

export declare function supportsAnimations(): boolean;

export declare function shouldReduceMotion(): boolean;

export declare function safeAnimateCompletion(
  cardElement: HTMLElement | null,
  onComplete?: () => void
): void;
