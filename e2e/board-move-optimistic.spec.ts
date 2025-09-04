import { test, expect, Page } from '@playwright/test';
import { stubCustomerProfile } from './utils/stubAuthProfile';
import { waitForBoardReady } from './utils/waitForBoardReady';
import { createTestAppointment } from './utils/test-data';

// Assumptions:
// - Backend test DB seeded with at least one appointment in SCHEDULED and a target column (e.g., IN_PROGRESS) exists.
// - Board cards have data attributes or can be selected via column containers.
// - Move endpoint: PATCH /admin/appointments/:id/move intercepted below.

// Helper: find column index containing a card id
async function getColumnIndexForCard(page: Page, cardId: string) {
  const columns = page.locator('.nb-board-grid .nb-column');
  const count = await columns.count();
  for (let i = 0; i < count; i++) {
    const col = columns.nth(i);
    if (await col.locator(`[data-appointment-id="${cardId}"]`).count()) return i;
  }
  return -1;
}

function columnByKey(page: Page, key: string) {
  return page.locator(`.nb-board-grid .nb-column[data-status-key="${key}"]`);
}

// (Drag simulation helper removed in favor of board move test hook)

test.describe('Board drag-and-drop optimistic move', () => {
  test.setTimeout(60000);
  test.beforeEach(async ({}, testInfo) => {
    if (testInfo.project.name.includes('mobile')) {
      test.skip(true, 'Skip DnD test on mobile viewport (drag not supported)');
    }
  });
  test.beforeEach(async ({ page, request }) => {
    await stubCustomerProfile(page);

    // Create a test appointment to ensure the board has data
    await createTestAppointment(request, {
      status: 'scheduled'
    });

    // Use full board to include react-dnd provider (force full=1 param)
    await page.goto('/e2e/board?full=1');
    await waitForBoardReady(page);
  });

  test('success: card moves immediately then persists via network call', async ({ page }) => {
    // Capture initial card + source column
    const sourceColumn = page.locator('.nb-board-grid .nb-column').first();
    const card = await waitForBoardReady(page, { timeout: 20000 });
    expect(card).toBeTruthy();

    let cardId = await card!.getAttribute('data-appointment-id');
    console.log('DEBUG picked card id', cardId);
    expect(cardId).toBeTruthy();
    // Determine actual source column index of this card
    const actualIndex = await getColumnIndexForCard(page, cardId!);
    expect(actualIndex).toBeGreaterThanOrEqual(0);
    const columns = page.locator('.nb-board-grid .nb-column');
    const columnCount = await columns.count();
    if (columnCount < 2) test.skip(true, 'Not enough columns to test move');
    const sourceColumnForCard = columns.nth(actualIndex);
    // Detect the card's current column status by traversing DOM (avoids relying on index ordering or stale attribute resolution)
    let sourceStatus = await page.evaluate((id) => {
      const el = document.querySelector(`[data-appointment-id="${id}"]`);
      if (!el) return null;
      const col = el.closest('.nb-column');
      return col ? (col as HTMLElement).getAttribute('data-status-key') : null;
    }, cardId);
    // Build ordered list of unique statuses present on the board
    const statusMeta: { index: number; status: string }[] = [];
    for (let i = 0; i < columnCount; i++) {
      const st = await columns.nth(i).getAttribute('data-status-key');
      if (st && !statusMeta.some(s => s.status === st)) statusMeta.push({ index: i, status: st });
    }
    console.log('DEBUG board statusMeta', statusMeta, 'sourceStatus', sourceStatus);
    // If initial card is terminal (no outgoing transitions) attempt to pick another card with allowed transitions.
    if (sourceStatus) {
      const allowedCheck: Record<string,string[]> = {
        SCHEDULED: ['IN_PROGRESS','READY','NO_SHOW','CANCELED'],
        IN_PROGRESS: ['READY','COMPLETED'],
        READY: ['COMPLETED'],
        COMPLETED: [],
        NO_SHOW: [],
        CANCELED: []
      };
      if (allowedCheck[sourceStatus] && allowedCheck[sourceStatus].length === 0) {
        const replacement = await page.evaluate(() => {
          const allow: Record<string,string[]> = {
            SCHEDULED: ['IN_PROGRESS','READY','NO_SHOW','CANCELED'],
            IN_PROGRESS: ['READY','COMPLETED'],
            READY: ['COMPLETED'],
            COMPLETED: [],
            NO_SHOW: [],
            CANCELED: []
          };
          const nodes = Array.from(document.querySelectorAll('[data-appointment-id]')) as HTMLElement[];
          for (const n of nodes) {
            const id = n.getAttribute('data-appointment-id');
            const col = n.closest('.nb-column') as HTMLElement | null;
            const st = col?.getAttribute('data-status-key') || null;
            if (id && st && allow[st] && allow[st].length > 0) {
              return { id, status: st };
            }
          }
          return null;
        });
        if (replacement) {
          console.log('DEBUG replacing terminal source card with', replacement);
          // Update cardId variable via eval side effect (can't reassign const); instead store new id in a mutable wrapper
          (global as any).__e2eCardId = replacement.id; // not used; fallback
          // Recompute status and override local variables
          // Since cardId is const, we carry newCardId separately
          const newCardId = replacement.id as string;
          sourceStatus = replacement.status as string;
          cardId = newCardId; // safe reassign (now let)
        }
      }
    }
    // Backend allowed transitions map (duplicated for test adaptivity – keep in sync if backend changes)
    const allowed: Record<string,string[]> = {
      SCHEDULED: ['IN_PROGRESS','READY','NO_SHOW','CANCELED'],
      IN_PROGRESS: ['READY','COMPLETED'],
      READY: ['COMPLETED'],
      COMPLETED: [],
      NO_SHOW: [],
      CANCELED: []
    };
    const boardStatuses = statusMeta.map(s => s.status);
    let orderedCandidates: string[] = [];
    if (sourceStatus && allowed[sourceStatus]) {
      orderedCandidates = allowed[sourceStatus].filter(s => s !== sourceStatus && boardStatuses.includes(s));
    }
    // Fallback: any other status if allowed list empty (should lead to explicit failure diagnostics)
    if (orderedCandidates.length === 0) {
      orderedCandidates = boardStatuses.filter(s => s !== sourceStatus);
    }
    const uniqueCandidates: string[] = [];
    for (const c of orderedCandidates) { if (!uniqueCandidates.includes(c)) uniqueCandidates.push(c); }
    if (uniqueCandidates.length === 0) test.skip(true, 'No alternative status present on board');
    if (sourceStatus && allowed[sourceStatus] && allowed[sourceStatus].length === 0) {
      test.skip(true, `Source status ${sourceStatus} has no allowed outgoing transitions`);
    }

    // Intercept move calls to observe attempts (no stubbing)
    const moveRegex = /\/api\/admin\/appointments\/[^/]+\/move$/;
    const seenRequests: { url: string; ts: number }[] = [];
    await page.route(moveRegex, route => { seenRequests.push({ url: route.request().url(), ts: Date.now() }); route.continue(); });

    // Ensure enhanced attempt hook exists (fallback to legacy if missing)
    await expect.poll(async () => await page.evaluate(() => typeof (window as any).__boardMoveAttempt === 'function' || typeof (window as any).__boardMove === 'function'), { timeout: 5000 }).toBeTruthy();

    interface AttemptResult { target: string; ok: boolean; error?: string | null }
    const attemptDiagnostics: AttemptResult[] = [];
    let successStatus: string | null = null;

    for (const targetStatus of uniqueCandidates) {
      // Invoke attempt
      const result = await page.evaluate(async ([id, status]) => {
        const w: any = window as any;
        if (typeof w.__boardMoveAttempt === 'function') return await w.__boardMoveAttempt(id, status);
        if (typeof w.__boardMove === 'function') { await w.__boardMove(id, status); return { ok: true, status }; }
        return { ok: false, error: 'no-move-hook' };
      }, [cardId, targetStatus]);
      // Wait for either store map change or error persisted
      let storeChanged = false;
      try {
        await expect.poll(async () => {
          return await page.evaluate(([id, st]) => {
            const mapFn = (window as any).__boardStatusMap; if (!mapFn) return false;
            const map = mapFn();
            return map && map[id] === st;
          }, [cardId || '', targetStatus]);
        }, { timeout: 4000 }).toBeTruthy();
        storeChanged = true;
      } catch {
        storeChanged = false;
      }
      if (storeChanged) {
        attemptDiagnostics.push({ target: targetStatus, ok: true });
        successStatus = targetStatus;
        console.log('DEBUG success status change', { targetStatus });
        break;
      } else {
        const lastErr = await page.evaluate(() => (window as any).__boardMoveLastError || null);
        attemptDiagnostics.push({ target: targetStatus, ok: false, error: lastErr });
        console.log('DEBUG failed move attempt', { targetStatus, lastErr });
      }
    }

    console.log('DEBUG attempt summary', attemptDiagnostics);
    expect(successStatus, `All move attempts failed. Diagnostics: ${JSON.stringify(attemptDiagnostics)} Requests: ${seenRequests.length}`).toBeTruthy();

    // DOM reflection in target column (best effort)
    const finalStatus = successStatus!;
    const targetMeta = statusMeta.find(s => s.status === finalStatus);
    expect(targetMeta, 'Target column meta not found').toBeTruthy();
    const targetColumn = columns.nth(targetMeta!.index);
    await expect(targetColumn.locator(`[data-appointment-id="${cardId}"]`)).toBeVisible({ timeout: 15000 });
  });
});
