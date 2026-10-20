import { chromium, type Browser, type Page } from 'playwright';
import { beforeAll, afterAll, expect, test, vi } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { DeepReview } from '@pitchcrew/core';
import { cleanup } from '../../orchestrator/test/helpers/daemon.ts';
import { deepReviewFixture } from '../../orchestrator/test/helpers/deep-reviews.ts';
const viteCache = vi.hoisted(() => ({ directory: '' }));
vi.mock('vite', async (importOriginal) => {
  const vite = await importOriginal<typeof import('vite')>();
  return {
    ...vite,
    createServer: (config: import('vite').InlineConfig) =>
      vite.createServer({ ...config, cacheDir: viteCache.directory }),
  };
});
let host: Awaited<ReturnType<typeof deepReviewFixture>>;
let browser: Browser;
let page: Page;
const errors: string[] = [];
beforeAll(async () => {
  viteCache.directory = await mkdtemp(join(tmpdir(), 'pitchcrew-review-ui-cache-'));
  host = await deepReviewFixture(24541);
  browser = await chromium.launch({ headless: true });
  page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  page.setDefaultTimeout(15000);
  page.on('pageerror', (error) => errors.push(error.message));
}, 60000);
afterAll(async () => {
  await browser?.close();
  await cleanup();
  if (viteCache.directory) await rm(viteCache.directory, { recursive: true, force: true });
});
test('job action runs the managed flow, saves explicit runtime alternatives and presents persisted reports on desktop and mobile', async () => {
  await page.goto(host.daemon.url);
  await page.locator(`#board-job-${host.card.id} .job-card`).waitFor({ timeout: 30000 });
  const defer = page.getByRole('button', { name: 'Set up later', exact: true });
  if (await defer.isVisible()) await defer.click();
  await page.locator(`#board-job-${host.card.id} .job-card`).click();
  await page.getByRole('tab', { name: 'Application', exact: true }).click();
  await page.getByRole('button', { name: 'Reviews Review needed', exact: true }).click();
  await page.getByRole('button', { name: 'Deep review resume', exact: true }).click();
  await page.getByText('Optional subagent runtime alternatives', { exact: true }).click();
  await page.getByRole('button', { name: 'Add runtime alternative', exact: true }).click();
  await page.getByText('Alternative 1', { exact: true }).waitFor();
  await page
    .getByRole('checkbox', { name: 'Request targeted second opinions', exact: true })
    .click();
  await page.getByRole('checkbox', { name: 'Demonstrated impact specialist', exact: true }).click();
  await page.getByRole('button', { name: 'Start deep review', exact: true }).click();
  await page.getByRole('tab', { name: 'Application', exact: true }).click();
  await page
    .getByRole('heading', { name: 'Resume review and packet recheck completed.', exact: true })
    .waitFor();
  const report = host.daemon.service.board.list<DeepReview>('deep_review')[0]!;
  expect(report.status).toBe('completed');
  expect(report.options.requestedPerspectives).toEqual(['impact']);
  expect(host.daemon.service.board.list('review_subagent')).toHaveLength(1);
  expect(report.options.alternatives).toEqual([{ runtime: 'demo', model: '', reasoning: null }]);
  expect(
    await page
      .locator('section[aria-label="Initial seven perspectives"] [data-slot="accordion-trigger"]')
      .count(),
  ).toBe(7);
  const perspectives = page.locator('section[aria-label="Initial seven perspectives"]');
  const firstPerspective = perspectives.getByRole('button').first();
  expect(await firstPerspective.getAttribute('aria-expanded')).toBe('false');
  await firstPerspective.focus();
  await page.keyboard.press('Enter');
  expect(await firstPerspective.getAttribute('aria-expanded')).toBe('true');
  await page.keyboard.press('Tab');
  expect(
    await perspectives
      .getByRole('button')
      .nth(1)
      .evaluate((node) => node === document.activeElement),
  ).toBe(true);
  await page.keyboard.press('Space');
  expect(await perspectives.getByRole('button').nth(1).getAttribute('aria-expanded')).toBe('true');
  expect(await firstPerspective.getAttribute('aria-expanded')).toBe('true');
  await page.getByText('Before and after resume', { exact: true }).click();
  expect(await page.getByLabel('Original resume', { exact: true }).innerText()).toContain(
    'Built a React interface.',
  );
  expect(await page.getByLabel('Improved resume', { exact: true }).innerText()).toContain(
    'Built a React interface.',
  );
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(await page.getByRole('tab', { name: 'Application', exact: true }).isVisible()).toBe(true);
  expect(
    await page
      .getByRole('tab', { name: 'Activity', exact: true })
      .evaluate((tab) => tab.getBoundingClientRect().right <= innerWidth),
  ).toBe(true);
  await page.reload();
  await page.locator(`#board-job-${host.card.id} .job-card`).click();
  await page.getByRole('tab', { name: 'Application', exact: true }).click();
  await page.locator('#job-section-reviews').click();
  await page
    .getByRole('heading', { name: 'Resume review and packet recheck completed.', exact: true })
    .waitFor();
  expect(host.daemon.service.board.list<DeepReview>('deep_review')).toHaveLength(1);
  expect(errors).toEqual([]);
}, 60000);
