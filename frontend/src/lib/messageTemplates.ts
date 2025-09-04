import rawTemplates from '@/data/messageTemplates.json';
import type { MessageChannel } from '@/types/models';

export interface MessageTemplate {
  id: string;
  label: string;
  channel: MessageChannel | 'any';
  category?: string;
  body: string; // May contain {{placeholders}}
  variables?: string[]; // Optional explicit variable list
}

export const messageTemplates: MessageTemplate[] = rawTemplates as MessageTemplate[];

// A nested context object (appointment, customer, vehicle etc.)
export type TemplatePrimitive = string | number | boolean | null | undefined | Date;
// Allow arbitrary nested records (loosely typed) to keep traversal simple
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export interface TemplateContext { [key: string]: TemplatePrimitive | TemplateContext | TemplatePrimitive[] | TemplateContext[] | Record<string, any>; }

// Regex rules:
// 1. Escaped double braces with leading backslash: \{{ ... }} -> unescape to literal {{ ... }}
// 2. Variable tokens: {{ path.to.value | fallback:"Some Fallback" }} (future fallback pipe reserved)
// For now we parse path (supports a-zA-Z0-9_ and dot separators) and ignore any pipe syntax after first segment.
const TOKEN_REGEX = /\\?{{\s*([^{}]+?)\s*}}/g; // captures inner expression, keeps optional leading backslash

interface ResolveOptions {
  missingTag?: (path: string) => string; // customize missing display
  dateFormatter?: (d: Date) => string;   // custom date formatting
}

export function resolvePath(ctx: TemplateContext, path: string): unknown {
  if (!path) return undefined;
  const segments = path.split('.');
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let cur: any = ctx; // internal traversal
  for (const seg of segments) {
    if (cur == null) return undefined;
    cur = cur[seg as keyof typeof cur];
  }
  return cur;
}

export function formatValue(v: unknown, opts?: ResolveOptions): string | undefined {
  if (v === undefined || v === null) return undefined;
  if (v instanceof Date) return opts?.dateFormatter ? opts.dateFormatter(v) : v.toISOString();
  if (typeof v === 'object') return undefined; // don't stringify objects (only primitives / Date)
  return String(v);
}

export function applyTemplate(template: MessageTemplate, ctx: TemplateContext = {}, opts: ResolveOptions = {}): string {
  const missingTag = opts.missingTag || ((p) => `[MISSING: ${p}]`);
  return template.body.replace(TOKEN_REGEX, (full, inner) => {
    // Handle escaped literal: starts with a backslash before {{
    if (full.startsWith('\\{{')) {
      // Return literal without the escape backslash
      return full.slice(1); // remove one leading backslash
    }
    const expr = inner.trim();
    // Support simple pipe for default fallback: path | "Some text" (quoted)
    let path = expr;
    let fallback: string | undefined;
    const pipeIndex = expr.indexOf('|');
    if (pipeIndex !== -1) {
      path = expr.slice(0, pipeIndex).trim();
      const rest = expr.slice(pipeIndex + 1).trim();
      // Try to parse quoted fallback
      const m = rest.match(/^"([^"]*)"|^'([^']*)'/);
      if (m) fallback = (m[1] ?? m[2]) as string;
    }
    // Only allow safe path characters
  if (!/^[a-zA-Z0-9_.]+$/.test(path)) return full; // leave untouched if invalid
    const value = resolvePath(ctx, path);
    const formatted = formatValue(value, opts);
    if (formatted !== undefined) return formatted;
    if (fallback !== undefined) return fallback;
    return missingTag(path);
  });
}

// Extract variables (dot paths) present in the template body (ignores escaped tokens)
export function extractTemplateVariables(body: string): string[] {
  const vars = new Set<string>();
  body.replace(TOKEN_REGEX, (full, inner) => {
    if (full.startsWith('\\{{')) return full; // escaped -> ignore
    const expr = inner.trim();
    const pipeIndex = expr.indexOf('|');
    const path = (pipeIndex === -1 ? expr : expr.slice(0, pipeIndex)).trim();
  if (/^[a-zA-Z0-9_.]+$/.test(path)) vars.add(path);
    return full;
  });
  return Array.from(vars.values());
}

export function getTemplatesForChannel(channel: MessageChannel): MessageTemplate[] {
  return messageTemplates.filter(t => t.channel === channel || t.channel === 'any');
}

export interface TemplateFilterOptions {
  query?: string;
  channel?: MessageChannel;
  category?: string; // exact match
}

export function filterTemplates(opts: TemplateFilterOptions): MessageTemplate[] {
  let list = messageTemplates;
  if (opts.channel) list = list.filter(t => t.channel === opts.channel || t.channel === 'any');
  if (opts.category && opts.category !== 'all') list = list.filter(t => t.category === opts.category);
  if (opts.query) {
    const q = opts.query.trim().toLowerCase();
    if (q) {
      list = list.filter(t =>
        t.label.toLowerCase().includes(q) ||
        t.body.toLowerCase().includes(q) ||
        (t.category || '').toLowerCase().includes(q)
      );
    }
  }
  return list;
}

// Convenience to build context from a DrawerPayload-like object (optional)
export interface DrawerLikeContext {
  appointment?: Record<string, unknown> | null;
  customer?: Record<string, unknown> | null;
  vehicle?: Record<string, unknown> | null;
  shop?: Record<string, unknown> | null;
}

export function buildTemplateContext(bundle: DrawerLikeContext): TemplateContext {
  // Provide flattened shortcuts as well as nested paths if needed
  const ctx: TemplateContext = {
    appointment: (bundle.appointment as TemplateContext) || {},
    customer: (bundle.customer as TemplateContext) || {},
    vehicle: (bundle.vehicle as TemplateContext) || {},
    shop: (bundle.shop as TemplateContext) || {}
  };
  return ctx;
}
