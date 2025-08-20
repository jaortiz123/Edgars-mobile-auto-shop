// Virtualization Hysteresis Controller (Phase A - Section 26)
// decideVirtualize(rows) applies consecutive-frame hysteresis with persistence.
// Enable after >= HIGH_ON_COUNT for REQUIRED_CONSEC frames.
// Disable after <= LOW_OFF_COUNT for REQUIRED_CONSEC frames.
// State persisted in sessionStorage under VIRT_HYST_KEY.

const HIGH_ON_COUNT = 200;
const LOW_OFF_COUNT = 120;
const REQUIRED_CONSEC = 3;
const VIRT_HYST_KEY = 'virt_hysteresis_state_v1';

interface HysteresisState {
  virtualized: boolean;
  highStreak: number;
  lowStreak: number;
  lastRows: number;
}

function loadState(): HysteresisState {
  if (typeof window === 'undefined') {
    return { virtualized: false, highStreak: 0, lowStreak: 0, lastRows: 0 };
  }
  try {
    const raw = sessionStorage.getItem(VIRT_HYST_KEY);
    if (!raw) return { virtualized: false, highStreak: 0, lowStreak: 0, lastRows: 0 };
    const parsed = JSON.parse(raw) as Partial<HysteresisState>;
    return {
      virtualized: !!parsed.virtualized,
      highStreak: parsed.highStreak || 0,
      lowStreak: parsed.lowStreak || 0,
      lastRows: parsed.lastRows || 0,
    };
  } catch {
    return { virtualized: false, highStreak: 0, lowStreak: 0, lastRows: 0 };
  }
}

function persistState(state: HysteresisState) {
  if (typeof window === 'undefined') return;
  try { sessionStorage.setItem(VIRT_HYST_KEY, JSON.stringify(state)); } catch { /* ignore */ }
}

let state: HysteresisState = loadState();

export function _resetVirtualizationHysteresis() { // test helper
  state = { virtualized: false, highStreak: 0, lowStreak: 0, lastRows: 0 };
  persistState(state);
}

export function decideVirtualize(rows: number): boolean {
  if (typeof rows !== 'number' || rows < 0) rows = 0;
  const s = state;

  // Update streaks
  if (rows >= HIGH_ON_COUNT) {
    s.highStreak += 1;
  } else {
    s.highStreak = 0;
  }
  if (rows <= LOW_OFF_COUNT) {
    s.lowStreak += 1;
  } else {
    s.lowStreak = 0;
  }

  // Enable condition
  if (!s.virtualized && s.highStreak >= REQUIRED_CONSEC) {
    s.virtualized = true;
    s.lowStreak = 0; // reset opposite streak
  }
  // Disable condition
  if (s.virtualized && s.lowStreak >= REQUIRED_CONSEC) {
    s.virtualized = false;
    s.highStreak = 0;
  }

  s.lastRows = rows;
  persistState(s);
  return s.virtualized;
}

export function isVirtualized() { return state.virtualized; }
