import { test, expect } from '@playwright/test';

test('inspect first appointment card styles', async ({ page }) => {
  await page.goto('http://localhost:5173/admin/dashboard', { waitUntil: 'networkidle' });

  // Wait for a card to appear
  await page.waitForSelector('.card-base', { timeout: 5000 });

  const handle = await page.$('.card-base');
  expect(handle).not.toBeNull();

  const styles = await page.evaluate((el) => {
    const get = (node: Element | null, prop: string) => node ? getComputedStyle(node as Element).getPropertyValue(prop) : null;
    const root = el as Element;
    const header = root.querySelector('div.flex.items-start') || root.querySelector('div');
    const avatar = root.querySelector('.w-10.h-10') || root.querySelector('img');
    const openBtn = Array.from(root.querySelectorAll('button')).find(b => (b as HTMLElement).innerText?.trim().toLowerCase().startsWith('open')) || null;

    return {
      card: {
        background: get(root, 'background') || get(root, 'background-color'),
        border: get(root, 'border'),
        boxShadow: get(root, 'box-shadow')
      },
      header: {
        background: get(header, 'background') || get(header, 'background-color'),
        color: get(header, 'color')
      },
      avatar: {
        background: get(avatar, 'background') || get(avatar, 'background-color'),
        color: get(avatar, 'color')
      },
      openButton: {
        background: get(openBtn, 'background') || get(openBtn, 'background-color'),
        border: get(openBtn, 'border'),
        color: get(openBtn, 'color')
      }
    };
  }, handle);

  console.log('CARD_STYLES_START');
  console.log(JSON.stringify(styles, null, 2));
  console.log('CARD_STYLES_END');

  // screenshot bounding box of the first card
  const box = await handle.boundingBox();
  if (box) {
    const screenshotPath = 'e2e-report/card-inspect.png';
    await page.screenshot({ path: screenshotPath, clip: { x: box.x, y: box.y, width: Math.min(box.width, 1200), height: Math.min(box.height, 1200) } });
    console.log('CARD_SCREENSHOT:', screenshotPath);
  }

});
