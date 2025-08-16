// Analytics dashboard response types (mirrors backend /api/admin/analytics/templates)

export interface TemplateTrendBucket {
  bucketStart: string; // ISO date (yyyy-mm-dd)
  count: number;
  sms?: number; // only present in channelTrend objects
  email?: number; // only present in channelTrend objects
}

export interface TemplateSlicePoint { bucketStart: string; count: number }

export interface TemplateAnalyticsTemplate {
  templateId: string;
  name: string; // human-friendly label
  channel: 'sms' | 'email' | 'mixed';
  totalCount: number;
  uniqueUsers: number;
  uniqueCustomers: number;
  lastUsedAt: string | null;
  firstUsedAt: string | null;
  trendSlice: TemplateSlicePoint[];
  pctOfTotal: number; // 0..1
  channels: Record<string, number>; // per-channel counts when mixed
}

export interface TemplateUsageSummary {
  topTemplates: Array<{ templateId: string; count: number }>;
  topUsers: Array<{ userId: string; count: number }>;
}

export interface TemplateAnalyticsTotals {
  events: number;
  uniqueTemplates: number;
  uniqueUsers: number;
  uniqueCustomers: number;
  byChannel: Record<string, { events: number; pct: number }>;
}

export interface TemplateAnalyticsResponse {
  range: { from: string; to: string; granularity: 'day' | 'week' };
  filters: { channel: string; limit: number };
  totals: TemplateAnalyticsTotals;
  trend: TemplateTrendBucket[];
  channelTrend: Array<{ bucketStart: string; sms: number; email: number }>;
  templates: TemplateAnalyticsTemplate[];
  usageSummary: TemplateUsageSummary;
  meta: { generatedAt: string; cache: { hit: boolean }; version: number };
}

export interface FetchTemplateAnalyticsParams {
  range?: '7d' | '30d' | '90d' | '180d';
  granularity?: 'day' | 'week';
  channel?: 'sms' | 'email' | 'all';
  limit?: number;
  include?: string;
  flush?: boolean;
}
