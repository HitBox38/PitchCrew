import { chromium, type Browser, type Page } from 'playwright';
import { afterAll, beforeAll, expect, test, vi } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { setup, cleanup } from '../../orchestrator/test/helpers/daemon.ts';
import { seedParallelQueue } from './fixtures/parallel-queue.ts';

const cache = vi.hoisted(() => ({ directory: '' }));
vi.mock('vite', async (importOriginal) => {
  const vite = await importOriginal<typeof import('vite')>();
  return {
    ...vite,
    createServer: (config: import('vite').InlineConfig) =>
      vite.createServer({ ...config, cacheDir: cache.directory }),
  };
});
let browser: Browser;
let page: Page;
let host: Awaited<ReturnType<typeof setup>>;
let fixture: ReturnType<typeof seedParallelQueue>;
const errors: string[] = [];
beforeAll(async () => {
  cache.directory = await mkdtemp(join(tmpdir(), 'pitchcrew-parallel-ui-cache-'));
  host = await setup(23942);
  fixture = seedParallelQueue(host.daemon.service);
  // Fill capacity so deterministic ready fixtures cannot dispatch.
  host.daemon.service.board.record(
    'queue_settings',
    { id: 'workspace', concurrency: 4 },
    'user',
    'Fixture limit',
  );
  browser = await chromium.launch({ headless: true });
  page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error' && message.text().startsWith('Base UI:'))
      errors.push(message.text());
  });
  await page.goto(`${host.daemon.url}/queue`, { waitUntil: 'domcontentloaded' });
  await page.locator('.queue-card').first().waitFor({ state: 'attached', timeout: 30000 });
  const later = page.getByRole('button', { name: 'Set up later', exact: true });
  if (await later.isVisible()) await later.click();
}, 60000);
afterAll(async () => {
  await browser?.close();
  await cleanup();
  if (cache.directory) await rm(cache.directory, { recursive: true, force: true });
});
test('distinguishes slots from parallel agent runs, background routines and queues on hold', async () => {
  const working = page.getByRole('region', { name: 'Running work', exact: true });
  await working.getByRole('article').first().waitFor();
  expect(await working.getByRole('article').count()).toBe(3);
  expect(await working.locator('.queue-agent-run').count()).toBe(5);
  expect(await working.textContent()).toContain('5 agent runs');
  expect(await page.locator('.queue-capacity').textContent()).toContain('4 of 4');
  expect(await page.locator('.queue-capacity').textContent()).toContain('1 background routine');
  expect(await page.getByRole('region', { name: 'Ready work' }).textContent()).toContain(
    'Maple Systems',
  );
  expect(await page.getByRole('region', { name: 'Work on hold' }).textContent()).toContain(
    'Offer comparison',
  );
  expect(
    await working
      .getByRole('article', { name: 'Northstar Labs: Product Engineer' })
      .getByRole('link', { name: 'View Scout activity' })
      .getAttribute('href'),
  ).toContain(`run=${fixture.scout.id}`);
  expect(await page.getByText('Reserved review seat', { exact: true }).count()).toBe(0);
  await page.screenshot({ path: '/tmp/pitchcrew-parallel-queue-desktop.png' });
});
test('opens a bounded widget with each simultaneous agent run and restores keyboard focus', async () => {
  const trigger = page.getByRole('button', { name: /^Work queue:/ });
  await trigger.focus();
  await page.keyboard.press('Enter');
  const panel = page.getByRole('dialog', { name: 'Work queue' });
  await panel.waitFor();
  await expect.poll(() => panel.evaluate((element) => getComputedStyle(element).opacity)).toBe('1');
  expect(await panel.textContent()).toContain('5 agent runs across 3 active queues');
  expect(await panel.locator('.queue-widget-agent').count()).toBe(5);
  expect(await panel.textContent()).toContain('1 background routine running');
  expect(await panel.textContent()).toContain('Offer comparison');
  await page.screenshot({ path: '/tmp/pitchcrew-parallel-queue-widget.png' });
  await page.keyboard.press('Escape');
  await expect
    .poll(() => trigger.evaluate((element) => element === document.activeElement))
    .toBe(true);
});
test('keeps page and widget within a narrow viewport in dark mode and reduced motion', async () => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'dark'));
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: /^Work queue:/ }).click();
  const panel = page.getByRole('dialog', { name: 'Work queue' });
  await panel.waitFor();
  await expect.poll(() => panel.evaluate((element) => getComputedStyle(element).opacity)).toBe('1');
  const bounds = await panel.boundingBox();
  expect(bounds!.x).toBeGreaterThanOrEqual(0);
  expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(390);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: '/tmp/pitchcrew-parallel-queue-mobile.png' });
  await page.keyboard.press('Escape');
  expect(errors).toEqual([]);
});

test('opens the conversation containing a forwarded question without using another slot', async () => {
  const answerThread = fixture.addWaitingQuestion();
  const card = page.getByRole('article', { name: 'Willow Robotics: Product Engineer' });
  await card.waitFor();
  expect(await page.getByRole('region', { name: 'Work on hold' }).textContent()).toContain(
    'Willow Robotics',
  );
  expect(await page.locator('.queue-capacity').textContent()).toContain('4 of 4');
  await card.getByRole('button', { name: 'Answer', exact: true }).click();
  await page.waitForURL(`**/chat/${answerThread}`);
  expect(errors).toEqual([]);
});
