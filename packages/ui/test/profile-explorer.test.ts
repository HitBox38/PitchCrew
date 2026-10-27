import { chromium, type Browser, type Page } from 'playwright';
import { afterAll, beforeAll, expect, test } from 'vitest';
import { cleanup, setup } from './helpers/daemon.ts';

let host: Awaited<ReturnType<typeof setup>>;
let browser: Browser;
let page: Page;
const name = 'Experience-Engineering-Leadership-and-Project-Highlights-0123456789abcdef.md';
const folder = 'Background-and-professional-project-documentation';
const errors: string[] = [];

beforeAll(async () => {
  host = await setup(14620);
  await host.daemon.service.saveProfile(name, '# Fictional career background');
  await host.daemon.service.saveProfile('Next-note.md', '# Another fictional note');
  await host.request('/profile/organization', 'POST', { action: 'create', path: folder });
  await host.request('/profile/organization', 'POST', { action: 'move', name, folder });
  browser = await chromium.launch({ headless: true });
}, 60000);

afterAll(async () => {
  await browser?.close();
  await cleanup();
});

test.each([1440, 1000, 390])(
  'long explorer labels stay inside their rows at %ipx',
  async (width) => {
    page = await browser.newPage({ viewport: { width, height: 800 }, reducedMotion: 'reduce' });
    page.setDefaultTimeout(10000);
    page.on('pageerror', (error) => errors.push(error.message));
    try {
      await page.goto(`${host.daemon.url}/profile`, { waitUntil: 'domcontentloaded' });
      await page.locator('.profile-workspace').waitFor();
      const later = page.getByRole('button', { name: 'Set up later', exact: true });
      if (await later.isVisible()) await later.click();
      const show = page.getByRole('button', { name: 'Show notes explorer', exact: true });
      if (await show.isVisible()) await show.click();
      const note = page.getByRole('treeitem', { name, exact: true });
      await note.waitFor();
      await page.evaluate(() => document.fonts.ready);
      for (const label of [folder, name]) {
        const item = page.getByRole('treeitem', { name: label, exact: true });
        const layout = await item.evaluate((element) => {
          const text = element.querySelector('span')!;
          const bounds = element.getBoundingClientRect();
          const labelBounds = text.getBoundingClientRect();
          const move = element.parentElement!.querySelector('.profile-move-note');
          return {
            rowHeight: bounds.height,
            labelHeight: labelBounds.height,
            lineHeight: parseFloat(getComputedStyle(text).lineHeight),
            top: labelBounds.top - bounds.top,
            bottom: bounds.bottom - labelBounds.bottom,
            right: (move?.getBoundingClientRect().left ?? bounds.right) - labelBounds.right,
            truncated: text.scrollWidth > text.clientWidth,
          };
        });
        expect(layout.labelHeight).toBeLessThanOrEqual(layout.lineHeight);
        expect(layout.rowHeight).toBeLessThanOrEqual(38);
        expect(layout.top).toBeGreaterThanOrEqual(0);
        expect(layout.bottom).toBeGreaterThanOrEqual(0);
        expect(layout.right).toBeGreaterThanOrEqual(0);
        if (width > 390 || label === name) expect(layout.truncated).toBe(true);
        expect(await item.getAttribute('title')).toBe(label);
      }
      await note.focus();
      const move = page.getByRole('button', { name: `Move ${name} to folder`, exact: true });
      expect(await move.evaluate((element) => getComputedStyle(element).opacity)).toBe('1');
      await page.keyboard.press('Enter');
      await page.getByRole('textbox', { name: 'Profile Markdown', exact: true }).waitFor();
      expect(await page.getByRole('textbox', { name: 'Profile Markdown' }).inputValue()).toContain(
        'Fictional career background',
      );
      expect(errors).toEqual([]);
    } finally {
      await page.close();
    }
  },
);
