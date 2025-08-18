import * as React from 'react';

/**
 * useRoving implements a simple roving tabindex pattern over a stable list of ids.
 * ArrowUp / ArrowDown move the active index. Returns helpers to wire into list items.
 */
export function useRoving(ids: string[]) {
  const [activeIdx, setActiveIdx] = React.useState(0);

  // Clamp when ids length changes
  React.useEffect(() => {
    setActiveIdx(i => Math.min(Math.max(i, 0), Math.max(0, ids.length - 1)));
  }, [ids.length]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      setActiveIdx(i => Math.min(i + 1, ids.length - 1));
      e.preventDefault();
    } else if (e.key === 'ArrowUp') {
      setActiveIdx(i => Math.max(i - 1, 0));
      e.preventDefault();
    }
  };

  const getTabIndex = (idx: number) => (idx === activeIdx ? 0 : -1);
  const isActive = (idx: number) => idx === activeIdx;

  return { activeIdx, setActiveIdx, onKeyDown, getTabIndex, isActive };
}
