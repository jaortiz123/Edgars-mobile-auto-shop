import React, { useState, useCallback } from 'react';
import type { BoardCard } from '@/types/models';
import { MultiSelectContext, type MultiSelectContextType } from './multiSelectContext';

export const MultiSelectProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [selectedCards, setSelectedCards] = useState<Set<string>>(new Set());
  const [isSelectionMode, setIsSelectionMode] = useState(false);

  const isCardSelected = useCallback((id: string) => {
    return selectedCards.has(id);
  }, [selectedCards]);

  const toggleCardSelection = useCallback((id: string) => {
    setSelectedCards(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  }, []);

  const selectCard = useCallback((id: string) => {
    setSelectedCards(prev => new Set(prev).add(id));
  }, []);

  const deselectCard = useCallback((id: string) => {
    setSelectedCards(prev => {
      const newSet = new Set(prev);
      newSet.delete(id);
      return newSet;
    });
  }, []);

  const selectMultiple = useCallback((ids: string[]) => {
    setSelectedCards(prev => {
      const newSet = new Set(prev);
      ids.forEach(id => newSet.add(id));
      return newSet;
    });
  }, []);

  const selectAll = useCallback((cards: BoardCard[]) => {
    setSelectedCards(new Set(cards.map(card => card.id)));
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedCards(new Set());
  }, []);

  const enterSelectionMode = useCallback(() => {
    setIsSelectionMode(true);
  }, []);

  const exitSelectionMode = useCallback(() => {
    setIsSelectionMode(false);
    clearSelection();
  }, [clearSelection]);

  const getSelectedCards = useCallback((allCards: BoardCard[]) => {
    return allCards.filter(card => selectedCards.has(card.id));
  }, [selectedCards]);

  const getSelectedColumnStatus = useCallback((allCards: BoardCard[]) => {
    const selected = getSelectedCards(allCards);
    if (selected.length === 0) return null;

    const statuses = new Set(selected.map(card => card.status || 'UNKNOWN'));
    // Return the status only if all selected cards are from the same column
    return statuses.size === 1 ? Array.from(statuses)[0] : null;
  }, [getSelectedCards]);

  const hasMultipleColumnsSelected = useCallback((allCards: BoardCard[]) => {
    const selected = getSelectedCards(allCards);
    if (selected.length <= 1) return false;

    const statuses = new Set(selected.map(card => card.status || 'UNKNOWN'));
    return statuses.size > 1;
  }, [getSelectedCards]);

  const selectAllInColumn = useCallback((allCards: BoardCard[]) => {
    const columnStatus = getSelectedColumnStatus(allCards);
    if (!columnStatus) return; // No single column identified

    // Find all cards in the same column
    const cardsInColumn = allCards.filter(card => (card.status || 'UNKNOWN') === columnStatus);
    const cardIdsInColumn = cardsInColumn.map(card => card.id);

    // Select all cards in the column
    setSelectedCards(new Set(cardIdsInColumn));
  }, [getSelectedColumnStatus]);

  const value: MultiSelectContextType = {
    selectedCards,
    isCardSelected,
    toggleCardSelection,
    selectCard,
    deselectCard,
    selectMultiple,
    selectAll,
    selectAllInColumn,
    clearSelection,
    selectedCount: selectedCards.size,
    isSelectionMode,
    enterSelectionMode,
    exitSelectionMode,
    getSelectedCards,
    getSelectedColumnStatus,
    hasMultipleColumnsSelected,
  };

  return (
    <MultiSelectContext.Provider value={value}>
      {children}
    </MultiSelectContext.Provider>
  );
};
