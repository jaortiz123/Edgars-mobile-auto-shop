import React, { createContext, useContext, useState, useCallback, useMemo, useEffect } from 'react';

export type CardFieldKey =
  | 'statusBadges'
  | 'vehicle'
  | 'customer'
  | 'tech'
  | 'timeChip'
  | 'onPremise'
  | 'promise'
  | 'repeat'
  | 'lastService'
  | 'workspacePref'
  | 'history'
  | 'customerNotes'
  | 'price';

export interface CardPreferencesState {
  enabled: Record<CardFieldKey, boolean>;
  setEnabled: (key: CardFieldKey, value: boolean) => void;
  reset: () => void;
  density: 'standard' | 'condensed';
  setDensity: (d: 'standard' | 'condensed') => void;
  order: CardFieldKey[];
  setOrder: (next: CardFieldKey[]) => void;
  moveField: (from: number, to: number) => void;
}

const DEFAULTS: Record<CardFieldKey, boolean> = {
  statusBadges: true,
  vehicle: true,
  customer: true,
  tech: false,
  timeChip: true,
  onPremise: true,
  promise: true,
  repeat: true,
  lastService: false,
  workspacePref: false,
  history: false,
  customerNotes: false,
  price: true,
};

const LS_KEY = 'adm.cardPrefs.v1';
const LS_KEY_ORDER = LS_KEY + '.order';

const DEFAULT_ORDER: CardFieldKey[] = [
  'statusBadges',
  'vehicle',
  'customer',
  'tech',
  'timeChip',
  'onPremise',
  'promise',
  'repeat',
  'lastService',
  'workspacePref',
  'history',
  'customerNotes',
  'price'
];

const Ctx = createContext<CardPreferencesState | undefined>(undefined);

export function CardPreferencesProvider({ children }: { children: React.ReactNode }) {
  const [enabled, setEnabledState] = useState<Record<CardFieldKey, boolean>>(() => {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        return { ...DEFAULTS, ...parsed };
      }
    } catch {/* ignore */}
    return DEFAULTS;
  });
  const [density, setDensityState] = useState<'standard' | 'condensed'>(() => {
    try {
      const raw = localStorage.getItem(LS_KEY + '.density');
      if (raw === 'condensed' || raw === 'standard') return raw;
    } catch {/* ignore */}
    return 'standard';
  });
  const [order, setOrderState] = useState<CardFieldKey[]>(() => {
    try {
      const raw = localStorage.getItem(LS_KEY_ORDER);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.every(k => (DEFAULT_ORDER as string[]).includes(k))) {
          // Ensure all keys present (append any new ones at end)
          const missing = DEFAULT_ORDER.filter(k => !parsed.includes(k));
          return [...parsed, ...missing];
        }
      }
    } catch {/* ignore */}
    return DEFAULT_ORDER;
  });

  useEffect(() => {
    try { localStorage.setItem(LS_KEY, JSON.stringify(enabled)); } catch {/* ignore */}
  }, [enabled]);
  useEffect(() => {
    try { localStorage.setItem(LS_KEY + '.density', density); } catch {/* ignore */}
  }, [density]);
  useEffect(() => {
    try { localStorage.setItem(LS_KEY_ORDER, JSON.stringify(order)); } catch {/* ignore */}
  }, [order]);

  // Reflect density class on root admin wrapper for CSS hooks
  useEffect(() => {
    const root = document.querySelector('.admin-neobrutal');
    if (!root) return;
    if (density === 'condensed') root.classList.add('nb-density-compact'); else root.classList.remove('nb-density-compact');
  }, [density]);

  const setEnabled = useCallback((key: CardFieldKey, value: boolean) => {
    setEnabledState(prev => ({ ...prev, [key]: value }));
  }, []);
  const setDensity = useCallback((d: 'standard' | 'condensed') => setDensityState(d), []);
  const setOrder = useCallback((next: CardFieldKey[]) => setOrderState(next), []);
  const moveField = useCallback((from: number, to: number) => {
    setOrderState(prev => {
      if (from === to || from < 0 || to < 0 || from >= prev.length || to >= prev.length) return prev;
      const copy = [...prev];
      const [item] = copy.splice(from, 1);
      copy.splice(to, 0, item);
      return copy;
    });
  }, []);

  const reset = useCallback(() => {
    setEnabledState(DEFAULTS);
    setOrderState(DEFAULT_ORDER);
  }, []);

  const value = useMemo(() => ({ enabled, setEnabled, reset, density, setDensity, order, setOrder, moveField }), [enabled, setEnabled, reset, density, setDensity, order, setOrder, moveField]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useCardPreferences() {
  const v = useContext(Ctx);
  if (!v) throw new Error('useCardPreferences must be inside CardPreferencesProvider');
  return v;
}
