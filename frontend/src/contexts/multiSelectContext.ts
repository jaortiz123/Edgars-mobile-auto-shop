import { createContext } from 'react';
import type { BoardCard } from '@/types/models';

export interface MultiSelectContextType {
  selectedCards: Set<string>;
  isCardSelected: (id: string) => boolean;
  toggleCardSelection: (id: string) => void;
  selectCard: (id: string) => void;
  deselectCard: (id: string) => void;
  selectMultiple: (ids: string[]) => void;
  selectAll: (cards: BoardCard[]) => void;
  selectAllInColumn: (allCards: BoardCard[]) => void;
  clearSelection: () => void;
  selectedCount: number;
  isSelectionMode: boolean;
  enterSelectionMode: () => void;
  exitSelectionMode: () => void;
  getSelectedCards: (allCards: BoardCard[]) => BoardCard[];
  getSelectedColumnStatus: (allCards: BoardCard[]) => string | null;
  hasMultipleColumnsSelected: (allCards: BoardCard[]) => boolean;
}

export const MultiSelectContext = createContext<MultiSelectContextType | null>(null);
