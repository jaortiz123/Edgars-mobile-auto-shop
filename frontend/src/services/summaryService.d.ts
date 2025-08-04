/**
 * Sprint 4A-T-002: Summary Service TypeScript Declarations
 */

export interface DailySummary {
  jobsCompleted: number;
  revenue: number;
  topTech: TopPerformer;
  date: string;
}

export interface TopPerformer {
  name: string;
  jobsCompleted: number;
}

export declare function getDailySummary(date?: Date | string): Promise<DailySummary>;
export declare function shouldShowDailySummary(): boolean;
export declare function markSummaryAsSeen(): void;
export declare function clearSummarySeenStatus(): void;
export declare function scheduleAutomaticSummary(callback: () => void): number;
export declare function getHistoricalSummaries(days?: number): Promise<DailySummary[]>;
