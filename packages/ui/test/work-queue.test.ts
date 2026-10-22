import { chromium, type Browser, type Page } from 'playwright';
import { afterAll, beforeAll, expect, test } from 'vitest';
import type { Card } from '@pitchcrew/core';
import { setup, cleanup } from './helpers/daemon.ts';

let host: Awaited<ReturnType<typeof setup>>;
let browser: Browser;
let page: Page;
let a: Card, b: Card;
const errors: string[] = [];
beforeAll(async () => {
  host = await setup(23941);
  a = host.daemon.service.createCard({ company: 'Fictional A', title: 'Engineer' });
  b = host.daemon.service.createCard({ company: 'Fictional B', title: 'Designer' });
  host.daemon.service.queueBoardAction({ cardId: a.id, action: 'draft' });
  host.daemon.service.queueBoardAction({ cardId: a.id, action: 'review' });
  host.daemon.service.queueBoardAction({ cardId: b.id, action: 'fit' });
  browser = await chromium.launch({ headless: true });
  page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  page.setDefaultTimeout(15000);
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(`${host.daemon.url}/queue`, { waitUntil: 'domcontentloaded' });
  await page.locator('.queue-card').first().waitFor({ state: 'attached', timeout: 30000 });
  const later = page.getByRole('button', { name: 'Set up later', exact: true });
  if (await later.isVisible()) await later.click();
}, 60000);
afterAll(async () => {
  await browser?.close();
  await cleanup();
});
test('opens the dedicated queue, saves capacity and reorders jobs with keyboard controls', async () => {
  await page.getByRole('heading', { name: 'Queue', exact: true }).waitFor();
  expect(await page.getByRole('heading', { name: 'Queue', exact: true }).count()).toBe(1);
  await page.getByRole('button', { name: /^Capacity settings,/ }).click();
  await page.getByLabel('Concurrent work', { exact: true }).fill('2');
  await page.getByRole('button', { name: 'Save limit', exact: true }).click();
  await expect.poll(() => host.daemon.service.queue().concurrency).toBe(2);
  const card = page.getByRole('article', { name: 'Fictional B: Designer' });
  await card.getByRole('button', { name: 'Drag to reorder, or use arrow keys' }).first().focus();
  await page.keyboard.press('ArrowUp');
  await expect.poll(() => host.daemon.service.queue().queues[0]?.cardId).toBe(b.id);
  const first = page.getByRole('article', { name: 'Fictional A: Engineer' });
  await first
    .getByRole('button', { name: 'Drag to reorder, or use arrow keys' })
    .first()
    .dragTo(card.getByRole('heading', { name: 'Fictional B: Designer' }));
  await expect.poll(() => host.daemon.service.queue().queues[0]?.cardId).toBe(a.id);
});
test('returns an invalid stage move to its saved order and permits deliberate repeats', async () => {
  const card = page.getByRole('article', { name: 'Fictional A: Engineer' });
  const review = card.locator('.queue-request').filter({ hasText: 'Review packet' });
  const response = page.waitForResponse(
    (r) => r.url().includes('/queue/requests/') && r.request().method() === 'PUT',
  );
  await review.getByRole('button', { name: 'Move up', exact: true }).click();
  expect((await response).status()).toBe(400);
  await expect
    .poll(() => card.locator('.queue-request').first().textContent())
    .toContain('Draft application');
  expect(
    host.daemon.service
      .queue()
      .queues.find((q) => q.cardId === a.id)
      ?.requests.map((r) => r.boardAction),
  ).toEqual(['draft', 'review']);
  await card.getByRole('button', { name: 'Add action', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Add queued action' });
  await dialog.getByRole('combobox', { name: 'Action', exact: true }).click();
  await page.getByRole('option', { name: 'Review packet', exact: true }).click();
  await dialog.getByRole('button', { name: 'Add to queue', exact: true }).click();
  await expect
    .poll(() => card.locator('.queue-request').filter({ hasText: 'Review packet' }).count())
    .toBe(2);
  await page.waitForTimeout(400);
  await page.screenshot({ path: '/tmp/pitchcrew-queue-desktop.png', fullPage: true });
});
test('keeps controls bounded on a narrow screen and respects reduced motion', async () => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth))
    .toBe(true);
  await page.screenshot({ path: '/tmp/pitchcrew-queue-mobile.png', fullPage: true });
  expect(errors).toEqual([]);
});
