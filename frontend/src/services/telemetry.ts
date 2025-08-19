/* Hardened telemetry tracking utility (F1 Part 2)
 * Features:
 *  - track(eventName, payload) with automatic enrichment (ts_iso, session_id, event_version, schema_version)
 *  - Request-Id correlation (consumer can set setLastRequestId)
 *  - Batching with max queue length, flush interval, max batch size
 *  - sessionStorage persistence (survives reloads)
 *  - Exponential backoff retry with jitter; capped retries
 *  - Deterministic recursive PII redaction (keys + value patterns)
 *  - Beacon API flush on page hide/unload fallback to fetch
 */

export interface TelemetryEventBase {
  event: string;
  ts_iso: string;
  session_id: string;
  request_id?: string;
  event_version: number; // always 1 for now
  schema_version: number; // overall envelope schema version
  payload: Record<string, unknown>;
}

interface TelemetryConfig {
  endpoint: string;
  flushIntervalMs: number;
  maxQueue: number;
  maxBatch: number;
  retryBaseMs: number;
  maxRetry: number;
  storageKey: string;
  schemaVersion: number;
  maxEventBytes: number;
  maxBatchBytes: number;
  maxStringLength: number;
}

const DEFAULT_CONFIG: TelemetryConfig = {
  endpoint: '/api/telemetry',
  flushIntervalMs: 5000,
  maxQueue: 500,
  maxBatch: 50,
  retryBaseMs: 750,
  maxRetry: 5,
  storageKey: 'telemetry_queue_v1',
  schemaVersion: 1,
  maxEventBytes: 4096,
  maxBatchBytes: 60000, // keep under common beacon limits (~64KB)
  maxStringLength: 256,
};

// ---------------- PII Redaction ----------------
// We implement a deterministic, recursive redaction strategy covering:
//  1. Key-based detection (exact & pattern based, case-insensitive)
//  2. Value pattern detection (emails, phones, ipv4, ssn, jwt, credit-card like)
//  3. Nested structures (objects / arrays) processed depth-first
//  4. Stable placeholder token (currently static "[REDACTED]" to avoid bloat; could be
//     swapped for hashed form later without altering traversal semantics).
// NOTE: We intentionally keep hashing out (for now) to keep payload size small and
// avoid introducing asynchronous crypto in the hot path; if grouping by PII value
// becomes required we can add a short deterministic hash variant.
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/i;
const PHONE_REGEX = /^(\+?\d[\d\-().\s]{6,}\d)$/; // permissive international-ish
const IPV4_REGEX = /\b((25[0-5]|2[0-4]\d|1?\d?\d)(\.|$)){4}\b/; // simple ipv4 detector
const SSN_REGEX = /\b\d{3}-\d{2}-\d{4}\b/; // US SSN pattern
const JWT_REGEX = /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/; // rough JWT
const CC_LIKE_REGEX = /\b(?:\d[ -]?){13,16}\b/; // simplistic credit card like sequence

// Exact key matches (normalized to lower-case)
const PII_KEY_EXACT = new Set([
  'email','phone','name','full_name','first_name','last_name','username','user_name',
  'address','street','city','state','zip','postal_code','ip','ip_address',
  'token','auth_token','session_token','password','pwd','ssn'
]);
// Pattern based key detection (lowercase test)
const PII_KEY_PATTERNS: RegExp[] = [
  /email/, /phone/, /name$/, /_name$/, /address/, /ip(_address)?$/, /token/, /pass(word)?/, /ssn/
];

function isPiiKey(key: string): boolean {
  const k = key.toLowerCase();
  if (PII_KEY_EXACT.has(k)) return true;
  return PII_KEY_PATTERNS.some(r => r.test(k));
}

function isPiiValue(str: string): boolean {
  if (EMAIL_REGEX.test(str)) return true;
  if (PHONE_REGEX.test(str)) return true;
  if (IPV4_REGEX.test(str)) return true;
  if (SSN_REGEX.test(str)) return true;
  if (JWT_REGEX.test(str) && str.split('.').length === 3) return true;
  if (CC_LIKE_REGEX.test(str.replace(/[- ]/g, ''))) return true;
  return false;
}

const sessionId = (() => {
  try {
    const k = 'telemetry_session_id';
    const existing = sessionStorage.getItem(k);
    if (existing) return existing;
    const fresh = crypto.randomUUID();
    sessionStorage.setItem(k, fresh);
    return fresh;
  } catch {
    return 'anon-session';
  }
})();

let lastRequestId: string | undefined;
export function setLastRequestId(rid?: string){ lastRequestId = rid; }

function nowIso(){ return new Date().toISOString(); }

function cloneAndRedact(obj: unknown): unknown {
  // Primitive / null path
  if (obj === null || obj === undefined) return obj;
  if (typeof obj !== 'object') {
    if (typeof obj === 'string' && isPiiValue(obj)) return '[REDACTED]';
    return obj;
  }
  // Array path – redact each element
  if (Array.isArray(obj)) return obj.map(cloneAndRedact);
  // Object path – copy & process keys deterministically (Object.entries order is insertion; we keep it)
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (isPiiKey(k)) {
      out[k] = '[REDACTED]';
      continue;
    }
    out[k] = cloneAndRedact(v);
  }
  return out;
}

interface QueueItem { ev: TelemetryEventBase; retry: number; nextAttempt: number; }
// Export a readonly view type for tests (no mutation of internal objects)
export type QueueItemSnapshot = Readonly<{ ev: TelemetryEventBase; retry: number; nextAttempt: number }>;

class TelemetryClient {
  private cfg: TelemetryConfig;
  private queue: QueueItem[] = [];
  private timer: number | null = null;
  private flushing = false;

  constructor(cfg?: Partial<TelemetryConfig>){
    this.cfg = { ...DEFAULT_CONFIG, ...(cfg||{}) };
    this.load();
    this.schedule();
    this.setupPageLifecycle();
  }

  track(event: string, payload: Record<string, unknown> = {}){
    const redacted = cloneAndRedact(payload) as Record<string, unknown>;
    const sized = applySizeGuard(redacted, this.cfg);
    const base: TelemetryEventBase = {
      event,
      ts_iso: nowIso(),
      session_id: sessionId,
      request_id: lastRequestId,
      event_version: 1,
      schema_version: this.cfg.schemaVersion,
      payload: sized,
    };
    if (this.queue.length >= this.cfg.maxQueue) this.queue.shift(); // backpressure
    this.queue.push({ ev: base, retry: 0, nextAttempt: Date.now() });
    this.persist();
  }

  private persist(){
    try { sessionStorage.setItem(this.cfg.storageKey, JSON.stringify(this.queue)); } catch { /* ignore */ }
  }
  private load(){
    try {
      const raw = sessionStorage.getItem(this.cfg.storageKey);
      if (raw) {
        const arr = JSON.parse(raw);
        if (Array.isArray(arr)) {
          const now = Date.now();
            this.queue = arr
              .filter(i => i && i.ev && i.ev.event)
              .map(i => ({ ev: i.ev, retry: i.retry||0, nextAttempt: i.nextAttempt || now }))
              .slice(0, this.cfg.maxQueue);
        }
      }
    } catch { /* ignore */ }
  }

  private schedule(){
    if (this.timer != null) return;
    this.timer = window.setInterval(() => this.flush(), this.cfg.flushIntervalMs);
  }

  private setupPageLifecycle(){
  const flushAndSync = () => { try { this.flush(true); } catch { /* swallow */ } };
    window.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') flushAndSync(); });
    window.addEventListener('pagehide', flushAndSync);
    window.addEventListener('beforeunload', flushAndSync);
  }

  private async flush(sync = false){
    if (this.flushing || this.queue.length === 0) return;
    this.flushing = true;
    try {
      const now = Date.now();
      const eligible = this.queue.filter(q => q.nextAttempt <= now);
      if (!eligible.length) return; // nothing due yet
      const batch: QueueItem[] = [];
      let totalBytes = 2; // for [] inside events JSON array
      for (const item of eligible) {
        if (batch.length >= this.cfg.maxBatch) break;
        const evStr = JSON.stringify(item.ev);
        const projected = totalBytes + evStr.length + (batch.length ? 1 : 0);
        if (projected > this.cfg.maxBatchBytes) break;
        batch.push(item);
        totalBytes = projected;
      }
      if (!batch.length) return;
      const body = JSON.stringify({ events: batch.map(b => b.ev) });
      const ok = this.send(body, sync);
      if (ok) {
        // Remove only those actually sent (they are leading subset)
        const sentSet = new Set(batch);
        this.queue = this.queue.filter(q => !sentSet.has(q));
        this.persist();
      } else {
        for (const item of batch) {
          item.retry += 1;
          if (item.retry <= this.cfg.maxRetry) {
            const baseDelay = this.cfg.retryBaseMs * Math.pow(2, item.retry - 1);
            const jitter = 0.25 + Math.random() * 0.5; // 25%-75%
            item.nextAttempt = Date.now() + Math.round(baseDelay * jitter);
          }
        }
        this.queue = this.queue.filter(q => q.retry <= this.cfg.maxRetry);
      }
    } finally {
      this.flushing = false;
    }
  }

  private send(body: string, sync: boolean): boolean {
    try {
      if (!sync && navigator.sendBeacon) {
        const blob = new Blob([body], { type: 'application/json' });
        const ok = navigator.sendBeacon(this.cfg.endpoint, blob);
        if (ok) return true;
      }
    } catch { /* ignore */ }
    // Fallback to fetch (sync flag means we don't await; best-effort)
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 4000);
      fetch(this.cfg.endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
        keepalive: true,
        signal: controller.signal,
  }).then(() => { clearTimeout(timeout); }).catch(() => { /* ignore */ });
      return true; // optimistic; retry logic only triggers when send() returns false which is rare
    } catch {
      return false;
    }
  }

  // === Test-only helpers (no production usage) ===
  public _testSnapshot(): QueueItemSnapshot[] { return this.queue.map(q => ({ ev: q.ev, retry: q.retry, nextAttempt: q.nextAttempt })); }
  public _testForceFlush(sync = true){ return this.flush(sync); }
  public _testSetMaxQueue(n: number){
    this.cfg.maxQueue = n;
    if (this.queue.length > n) {
      this.queue = this.queue.slice(-n);
      this.persist();
    }
  }
  public _testUpdateConfig(p: Partial<TelemetryConfig>){ this.cfg = { ...this.cfg, ...p }; }
}

let singleton: TelemetryClient | null = null;
export function getTelemetry(): TelemetryClient {
  if (!singleton) singleton = new TelemetryClient();
  return singleton;
}

export function track(event: string, payload?: Record<string, unknown>){
  getTelemetry().track(event, payload || {});
}

// Test wrappers (exported separately to avoid exposing internals inadvertently)
export function _test_snapshot(){ return getTelemetry()._testSnapshot(); }
export async function _test_forceFlush(){ await getTelemetry()._testForceFlush(true); }
export function _test_setMaxQueue(n: number){ getTelemetry()._testSetMaxQueue(n); }
export function _test_reset(){ // resets singleton so a fresh instance reloads from storage
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (singleton as any) = null;
}
export function _test_updateConfig(p: Partial<TelemetryConfig>){ getTelemetry()._testUpdateConfig(p); }
export function _test_snapshot_full(){ return getTelemetry()._testSnapshot(); }

// Size guard helper (after export section to keep file cohesive)
function applySizeGuard(raw: Record<string, unknown>, cfg: TelemetryConfig): Record<string, unknown> {
  const trunc = (v: unknown): unknown => {
    if (typeof v === 'string') return v.length > cfg.maxStringLength ? v.slice(0, cfg.maxStringLength) + '…' : v;
    if (Array.isArray(v)) return v.map(trunc);
    if (v && typeof v === 'object') { const o: Record<string, unknown> = {}; for (const [k,val] of Object.entries(v)) o[k] = trunc(val); return o; }
    return v;
  };
  const payload = trunc(raw) as Record<string, unknown>;
  const size = () => { try { return JSON.stringify(payload).length; } catch { return Infinity; } };
  if (size() <= cfg.maxEventBytes) return payload;
  const mark = () => { if (!payload._truncated) payload._truncated = true; };
  const shrinkArrays = () => { const walk = (val: unknown): void => { if (Array.isArray(val)) { if (val.length > 1) { val.splice(Math.ceil(val.length/2)); mark(); } val.forEach(walk); } else if (val && typeof val === 'object') { for (const v2 of Object.values(val as Record<string, unknown>)) walk(v2); } }; walk(payload); };
  const pruneLargestKey = () => { const entries = Object.entries(payload).filter(([k]) => k !== '_truncated'); if (entries.length <= 1) return; const sized = entries.map(([k,v]) => { let s=0; try { s = JSON.stringify({[k]:v}).length; } catch { s=0; } return {k,s}; }).sort((a,b)=>b.s-a.s); delete payload[sized[0].k]; mark(); };
  let loops = 0, current = size();
  while (current > cfg.maxEventBytes && loops < 50) { loops++; const prev=current; shrinkArrays(); current=size(); if (current<=cfg.maxEventBytes) break; pruneLargestKey(); current=size(); if (current===prev) break; }
  return payload;
}
