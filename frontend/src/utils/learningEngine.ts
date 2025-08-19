import type { BoardCard } from '@/types/models';

export class LearningEngine {
  private static STORAGE_KEY = 'edgar_preferences';

  static learnFromAction(action: any) {
    const preferences = this.getPreferences();
    // simplified: just store last action timestamp
    preferences.lastAction = { type: action?.type || 'unknown', at: new Date().toISOString() };
    this.savePreferences(preferences);
  }

  static getSmartDefaults(context: any) {
    const preferences = this.getPreferences();
    return {
      preferredTech: preferences.preferredTech || null,
      optimalWorkspace: preferences.optimalWorkspace || null,
      estimatedDuration: preferences.serviceDurations?.[context?.serviceType]?.averageDuration || null,
      suggestedStartTime: new Date()
    };
  }

  static getPreferences() {
    try {
      const raw = localStorage.getItem(this.STORAGE_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch { return {}; }
  }

  private static savePreferences(p: any) {
    try { localStorage.setItem(this.STORAGE_KEY, JSON.stringify(p)); } catch (e) { console.warn('Failed saving prefs', e); }
  }

  static getWorkflowRecommendations(currentTime: Date, cards: BoardCard[]) {
    // Simplified wrapper that suggests batching similar services
    const map = new Map<string, BoardCard[]>();
    for (const c of cards.filter(c => c.status === 'SCHEDULED')) {
      const key = c.servicesSummary || 'other';
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(c);
    }
    const recommendations: any[] = [];
    for (const [serviceType, jobs] of map.entries()) {
      if (jobs.length >= 2) recommendations.push({ type: 'batching', title: `Batch ${serviceType} Jobs`, description: `${jobs.length} jobs`, cards: jobs, confidence: 0.8 });
    }
    return recommendations;
  }
}

export default LearningEngine;
