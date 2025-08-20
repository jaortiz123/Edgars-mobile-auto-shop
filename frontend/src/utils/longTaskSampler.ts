// Adaptive Long Task Sampler (Phase A - Metrics & Guards)
// Implements shouldSampleLongTask(budgetBurn) per redline spec Section 7.
// Baseline sample rate r0 = 0.10 (10%). We adjust sampling rate upward
// when budgetBurn (fraction of frame budget consumed by long tasks in recent window)
// increases, and decay it back toward baseline when healthy.
//
// budgetBurn is expected to be a float in [0,1+] representing proportion of
// the 16ms frame budget consumed (aggregated) over a sliding window.
// For now (stub integration) callers may pass a heuristic or placeholder.
//
// Adjustment rules (tunable constants):
// - If budgetBurn >= 0.8: ramp aggressively (multiply by 2, cap MAX_RATE)
// - Else if budgetBurn >= 0.5: moderate increase (+0.10 absolute)
// - Else if budgetBurn >= 0.25: mild increase (+0.05 absolute)
// - Else (healthy): decay toward baseline using linear blend.
//
// Decay: r = r - DECAY_STEP if r > BASE_RATE.
// All updates rate-limited to once per WINDOW_MS to avoid thrash.
// We also include jitter to avoid synchronized sampling bursts across clients.
//
// Returned decision uses Math.random() < currentRate.
// Expose functions for testability.

const BASE_RATE = 0.10;
const MAX_RATE = 0.90;
const DECAY_STEP = 0.05;
const WINDOW_MS = 5000; // adjust at most every 5s

let currentRate = BASE_RATE;
let lastAdjust = 0;

// Optional: allow external reset (tests)
export function _resetLongTaskSampler() {
  currentRate = BASE_RATE;
  lastAdjust = 0;
}

function adjustSamplingRate(budgetBurn: number, now: number) {
  if (now - lastAdjust < WINDOW_MS) return; // rate limit adjustments
  const prev = currentRate;
  if (budgetBurn >= 0.8) {
    currentRate = Math.min(MAX_RATE, currentRate * 2);
  } else if (budgetBurn >= 0.5) {
    currentRate = Math.min(MAX_RATE, currentRate + 0.10);
  } else if (budgetBurn >= 0.25) {
    currentRate = Math.min(MAX_RATE, currentRate + 0.05);
  } else {
    // healthy zone: decay
    if (currentRate > BASE_RATE) {
      currentRate = Math.max(BASE_RATE, currentRate - DECAY_STEP);
    }
  }
  if (currentRate !== prev) {
    // small random jitter +/-2% to reduce global sync
    const jitter = (Math.random() * 0.04) - 0.02;
    currentRate = Math.min(MAX_RATE, Math.max(BASE_RATE, currentRate + jitter));
  }
  lastAdjust = now;
}

export function shouldSampleLongTask(budgetBurn: number): boolean {
  if (typeof budgetBurn !== 'number' || isNaN(budgetBurn)) budgetBurn = 0; // guard
  const now = performance.now();
  adjustSamplingRate(budgetBurn, now);
  return Math.random() < currentRate;
}

// Integration helper to wire PerformanceObserver('longtask')
export function initAdaptiveLongTaskObserver(
  report: (entry: PerformanceEntry, meta: { rate: number; budgetBurn: number }) => void,
  getBudgetBurn?: () => number
) {
  if (typeof window === 'undefined' || !(window as unknown as { PerformanceObserver?: typeof PerformanceObserver }).PerformanceObserver) return;
  try {
    const observer = new PerformanceObserver(list => {
      const burn = getBudgetBurn ? getBudgetBurn() : 0; // stubbed for now
      list.getEntries().forEach(entry => {
        if (entry.entryType === 'longtask') {
          if (shouldSampleLongTask(burn)) {
            report(entry, { rate: currentRate, budgetBurn: burn });
          }
        }
      });
    });
    observer.observe({ entryTypes: ['longtask'] as PerformanceObserverInit['entryTypes'] });
    return observer;
  } catch {
    // Silently ignore — some browsers behind flags; optionally console.debug
    return undefined;
  }
}

export function getCurrentLongTaskSampleRate() {
  return currentRate;
}
