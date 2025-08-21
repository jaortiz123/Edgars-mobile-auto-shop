// Temporary diagnostic utility to log every /api/ network request/response/failure.
// Import and call attachNetworkLogger(page) early in a spec to trace bootstrap failures.
import { Page } from '@playwright/test';

export function attachNetworkLogger(page: Page) {
  const reqStart = new Map<string, number>();
  const now = () => Date.now();
  page.on('request', req => {
    const url = req.url();
    if (url.includes('/api/')) {
      reqStart.set(req.url()+req.method(), now());
      // eslint-disable-next-line no-console
      console.log(`[API REQ] ${req.method()} ${url}`);
    }
  });
  page.on('response', async resp => {
    try {
      const req = resp.request();
      const url = req.url();
      if (url.includes('/api/')) {
        const key = req.url()+req.method();
        const started = reqStart.get(key);
        const dur = started ? (now() - started) : undefined;
        // eslint-disable-next-line no-console
        console.log(`[API RES] ${resp.status()} ${req.method()} ${url}${dur!==undefined ? ` (${dur}ms)` : ''}`);
        if (req.method() === 'OPTIONS' || url.includes('/appointments/board')) {
          const resHeaders = await resp.headers();
          const reqHeaders = req.headers();
          // eslint-disable-next-line no-console
          console.log(`[API RES HEADERS] ${req.method()} ${url} RESPONSE=${JSON.stringify(resHeaders)} REQUEST=${JSON.stringify(reqHeaders)}`);
        }
      }
    } catch (e) {
      console.log('[API RES LOG ERROR]', (e as Error).message); // eslint-disable-line no-console
    }
  });
  page.on('requestfailed', req => {
    const url = req.url();
    if (url.includes('/api/')) {
      const key = req.url()+req.method();
      const started = reqStart.get(key);
      const dur = started ? (now() - started) : undefined;
      // eslint-disable-next-line no-console
      console.log(`[API FAIL] ${req.failure()?.errorText || 'unknown-error'} ${req.method()} ${url}${dur!==undefined ? ` (${dur}ms)` : ''}`);
      if (req.method() === 'OPTIONS' || url.includes('/appointments/board')) {
        // We may have already logged headers in response; note failure context.
        // eslint-disable-next-line no-console
        console.log(`[API FAIL CONTEXT] ${req.method()} ${url} REQUEST_HEADERS=${JSON.stringify(req.headers())}`);
      }
    }
  });
}
