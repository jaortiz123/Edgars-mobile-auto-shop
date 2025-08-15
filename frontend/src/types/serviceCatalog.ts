// Phase 1 Service Catalog Types & Utilities (frontend only)
// These are additive & backward-compatible.

export type ServiceDefinition = {
  id: string;        // stable: srv_<system>_<slug>
  slug: string;      // kebab-case lookup key
  name: string;      // human display name
  system?: string;   // logical grouping e.g. 'Brakes'
  operation?: string; // specific operation label
  position?: string; // Front | Rear | Both | etc.
  // Legacy estimate field (will be superseded by defaultLaborHours)
  defaultHours?: number;
  // New pricing scaffolding
  defaultLaborHours?: number; // prefer this over defaultHours
  laborRateCode?: string;     // e.g. STD, EURO, DIESEL
  defaultPartsCostEstimate?: number; // estimated cost of parts
  defaultShopFeePct?: number; // percent (0-1) applied to labor+parts
  defaultPartsKitIds?: string[];
  synonyms?: string[]; // lowercase search terms
  tags?: string[];
  // Relationships (Phase 1.5 passive)
  bundleChildServiceIds?: string[];       // service ids included when this is a bundle
  recommendedServiceIds?: string[];       // suggested upsells / dependencies
  mutuallyExclusiveServiceIds?: string[]; // services that should not co-exist
};

// ServiceCatalogItem is the forward-looking canonical item shape the UI will consume.
// It is intentionally a superset-friendly alias around ServiceDefinition for Phase 2
// so we can extend (pricing, flags, metadata) without breaking existing code.
// Keep it structurally compatible so existing arrays can be cast cheaply.
export interface ServiceCatalogItem extends ServiceDefinition {
  // Derived convenience fields (added lazily when building index; optional so raw
  // JSON need not include them).
  keywords?: string[]; // pre-computed lowercase tokens for faster filtering
  label?: string;      // caching of display label (system + name, etc.)
  deprecated?: boolean; // future: mark for hiding from default search
}

export interface ServiceCatalogSearchIndex {
  all: ServiceCatalogItem[];
  byId: Record<string, ServiceCatalogItem>;
  search: (q: string) => ServiceCatalogItem[];
}

// Build a lightweight in-memory index with derived keyword arrays.
export function buildServiceCatalogIndex(items: ServiceCatalogItem[]): ServiceCatalogSearchIndex {
  const enriched = items.map(it => {
    if (it.keywords && it.label) return it; // already enriched
    const kw = new Set<string>();
    const push = (v?: string | string[]) => {
      if (!v) return;
      if (Array.isArray(v)) v.forEach(s => s && kw.add(s.toLowerCase()));
      else kw.add(v.toLowerCase());
    };
    push(it.name);
    push(it.slug);
    push(it.system);
    push(it.operation);
    push(it.position);
    push(it.synonyms);
    push(it.tags);
    const label = it.system ? `${it.system}: ${it.name}` : it.name;
    return { ...it, keywords: Array.from(kw), label } as ServiceCatalogItem;
  });
  const byId: Record<string, ServiceCatalogItem> = Object.fromEntries(enriched.map(e => [e.id, e]));
  const search = (q: string) => {
    const needle = q.trim().toLowerCase();
    if (!needle) return enriched;
    return enriched.filter(it =>
      it.keywords?.some(k => k.includes(needle)) ||
      it.label?.toLowerCase().includes(needle)
    );
  };
  return { all: enriched, byId, search };
}

export type JobOperation = {
  serviceId: string;           // FK to ServiceDefinition.id
  customTitle?: string;        // manual override
  positionOverride?: string;   // overrides catalog position
  approved?: boolean;
  addedAt?: string;            // ISO
  removedAt?: string | null;
  // Quoted financials (all optional; computed by pricing engine later)
  quotedLaborHours?: number;
  quotedPartsSubtotal?: number;
  quotedShopFees?: number;
  quotedTotal?: number;
  // Actuals for profitability tracking
  actualLaborHours?: number;
  actualPartsCost?: number;
  // Approval workflow (supersedes simple approved boolean eventually)
  approvalStatus?: 'PENDING' | 'APPROVED' | 'REJECTED';
  approvedByUserId?: string;
  approvedAt?: string;
  // Operation-level blocker + notes
  blockerCode?: BlockerCode;
  blockerNotes?: string;
  technicianId?: string; // specific tech for this operation
};

export type BlockerCode =
  | 'WAITING_PARTS'
  | 'NEEDS_AUTH'
  | 'WAITING_CUSTOMER'
  | 'DIAGNOSING'
  | 'QC_CHECK'
  | 'COMEBACK';

export const BLOCKER_LABEL: Record<BlockerCode, string> = {
  WAITING_PARTS: 'Waiting Parts',
  NEEDS_AUTH: 'Needs Approval',
  WAITING_CUSTOMER: 'Waiting Customer',
  DIAGNOSING: 'Diagnosing',
  QC_CHECK: 'QC Check',
  COMEBACK: 'Comeback'
};

// Pure composition (Phase 1) — will be relocated if shared with backend later.
export function composeJobTitle(op: JobOperation, def?: ServiceDefinition): string {
  if (!def) return op.customTitle || 'Service';
  if (op.customTitle) return op.customTitle.trim();
  const base = def.name.trim();
  const pos = op.positionOverride || def.position;
  if (!pos) return base;
  const regex = new RegExp(`^(${pos})\\b`, 'i');
  return regex.test(base) ? base : `${pos} ${base.replace(/^(Front|Rear|Both)\s+/i, '')}`;
}

export function resolveHeadline(
  primary?: JobOperation,
  def?: ServiceDefinition,
  fallback?: string,
  additionalCount = 0
): string {
  let title = primary ? composeJobTitle(primary, def) : (fallback || 'Service');
  if (additionalCount > 0) title += ` +${additionalCount}`;
  return title;
}
