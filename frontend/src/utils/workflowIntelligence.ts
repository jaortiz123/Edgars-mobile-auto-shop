import type { BoardCard } from '@/types/models';

export type SuggestionType = 'urgent' | 'warning' | 'suggestion' | 'info';

export interface SmartSuggestion {
  type: SuggestionType;
  title: string;
  description: string;
  action: string;
  cards: BoardCard[];
  priority: number;
}

export class WorkflowIntelligence {
  static getSmartSuggestions(cards: BoardCard[], currentTime: Date): SmartSuggestion[] {
    const suggestions: SmartSuggestion[] = [];

    const inProgress = cards.filter(c => c.status === 'IN_PROGRESS');
    const scheduled = cards.filter(c => c.status === 'SCHEDULED');
    const ready = cards.filter(c => c.status === 'READY');

    const overdue = cards.filter(c => c.isOverdue);
    if (overdue.length > 0) {
      suggestions.push({
        type: 'urgent',
        title: 'Appointments Running Late',
        description: `${overdue.length} appointment${overdue.length > 1 ? 's are' : ' is'} overdue`,
        action: 'prioritize_overdue',
        cards: overdue,
        priority: 10,
      });
    }

    const nextScheduled = scheduled
      .filter(c => typeof c.timeUntilStart === 'number' && (c.timeUntilStart as number) <= 60)
      .sort((a, b) => (a.timeUntilStart || 0) - (b.timeUntilStart || 0))[0];

    if (nextScheduled && inProgress.length === 0) {
      const hour = currentTime.getHours();
      const morningBoost = hour >= 8 && hour <= 10 ? 1 : 0; // prioritize prep in the morning
      suggestions.push({
        type: 'suggestion',
        title: 'Ready to Start Next Job',
        description: `${nextScheduled.servicesSummary || 'Service'} in ${nextScheduled.timeUntilStart}m`,
        action: 'prep_workspace',
        cards: [nextScheduled],
        priority: 8 + morningBoost,
      });
    }

    if (inProgress.length >= 2) {
      const bayConflicts = this.detectBayConflicts(inProgress);
      if (bayConflicts.length > 0) {
        suggestions.push({
          type: 'warning',
          title: 'Workspace Conflict',
          description: 'Multiple jobs assigned to same bay',
          action: 'reassign_workspace',
          cards: bayConflicts,
          priority: 7,
        });
      }
    }

    const partsNeeded = scheduled.filter(c => (c.partsRequired || []).some(p => !p.inStock)).slice(0, 3);
    if (partsNeeded.length > 0) {
      suggestions.push({
        type: 'info',
        title: 'Parts Check Required',
        description: `${partsNeeded.length} upcoming jobs need parts`,
        action: 'check_parts',
        cards: partsNeeded,
        priority: 5,
      });
    }

    const quickJobs = ready.filter(c => typeof c.estimatedDuration === 'number' && (c.estimatedDuration as number) <= 30);
    if (quickJobs.length > 0 && inProgress.length === 0) {
      suggestions.push({
        type: 'suggestion',
        title: 'Quick Win Available',
        description: `${quickJobs.length} job${quickJobs.length > 1 ? 's' : ''} under 30 minutes`,
        action: 'start_quick_job',
        cards: quickJobs,
        priority: 6,
      });
    }

    return suggestions.sort((a, b) => b.priority - a.priority);
  }

  static detectBayConflicts(cards: BoardCard[]): BoardCard[] {
    const seen = new Set<string>();
    const conflicts: BoardCard[] = [];
    for (const c of cards) {
      const bay = String(c.workspacePreference || '');
      if (!bay) continue;
      const key = `bay:${bay}`;
      if (seen.has(key)) conflicts.push(c);
      else seen.add(key);
    }
    return conflicts;
  }

  static predictCompletionTime(card: BoardCard): Date | null {
    if (!card.start || !card.estimatedDuration) return null;
    const startTime = new Date(card.start);
    let adjustment = 1;
    if (card.complexity === 'complex') adjustment = 1.3;
    if (card.complexity === 'simple') adjustment = 0.8;
    return new Date(startTime.getTime() + (card.estimatedDuration * 60000 * adjustment));
  }

  static getOptimalStartTime(card: BoardCard, currentWorkload: BoardCard[]): Date {
    const now = new Date();
    const busyTechs = currentWorkload
      .filter(c => c.status === 'IN_PROGRESS' && !!c.techAssigned)
      .map(c => c.techAssigned as string);
    if (card.techAssigned && busyTechs.includes(card.techAssigned)) {
      return new Date(now.getTime() + 15 * 60000); // naive: suggest 15m later
    }
    return now;
  }
}

export default WorkflowIntelligence;
