/**
 * Sprint 4A-T-002: Daily Achievement Summary TypeScript Declarations
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

export interface DailyAchievementSummaryProps {
  isOpen: boolean;
  onClose: () => void;
  jobsCompleted: number;
  revenue: number;
  topTech: TopPerformer;
  date: string;
}

export interface DailyAchievementSummaryCardProps {
  jobsCompleted: number;
  revenue: number;
  topTech: TopPerformer;
  date: string;
  onViewDetails: () => void;
}

export interface UseDailyAchievementSummaryReturn {
  isOpen: boolean;
  summaryData: DailySummary | null;
  loading: boolean;
  error: string | null;
  showSummary: (date?: Date | string) => Promise<void>;
  closeSummary: () => void;
  loadSummary: (date?: Date | string) => Promise<DailySummary | null>;
}

// Runtime components exist in .jsx, declare here for TS consumers
export declare function DailyAchievementSummary(props: DailyAchievementSummaryProps): JSX.Element;
export declare function DailyAchievementSummaryCard(props: DailyAchievementSummaryCardProps): JSX.Element;
declare const _default: typeof DailyAchievementSummary;
export default _default;

export declare function getDailySummary(date?: Date | string): Promise<DailySummary>;
export declare function shouldShowDailySummary(): boolean;
export declare function markSummaryAsSeen(): void;
export declare function clearSummarySeenStatus(): void;
export declare function scheduleAutomaticSummary(callback: () => void): number;
export declare function getHistoricalSummaries(days?: number): Promise<DailySummary[]>;
