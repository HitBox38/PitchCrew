import type { Card } from '@pitchcrew/core';
import { chromium, type Browser } from 'playwright';
import { afterAll, expect, test } from 'vitest';
// The development UI (Vite and development React) is deliberate here: React reports misuse of
// `use()` only in development builds, which the shared production UI fixture cannot show.
import { cleanup, setup } from '../../orchestrator/test/helpers/daemon.ts';

let browser: Browser | undefined;

afterAll(async () => {
  await browser?.close();
  await cleanup();
});

test('lazy pages and panels suspend the way development React expects', async () => {
  const host = await setup(14785, false, { ui: 'dev', uiCache: 'temporary' });
  host.daemon.service.onboarding.save({ version: 1, status: 'dismissed', step: 0 });
  const { result: card } = await host.request<Card>('/cards', 'POST', {
    company: 'Lazy Fixture (fictional)',
    title: 'Interface Engineer',
    description: 'Build interfaces.',
  });
  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({
    viewport: { width: 1280, height: 900 },
    reducedMotion: 'reduce',
  });
  const reports: string[] = [];
  page.on('console', (message) => {
    if (['error', 'warning'].includes(message.type())) reports.push(message.text());
  });
  // The app shell, Board, the job sheet and Decisions are each a first-time lazy import here.
  await page.goto(host.daemon.url);
  const job = page.locator(`#board-job-${card.id} .clay-job-card`);
  await job.waitFor({ timeout: 90000 });
  await job.click();
  const sheet = page.getByRole('dialog', { name: 'Job details', exact: true });
  await sheet.getByText('Interface Engineer').first().waitFor({ timeout: 30000 });
  await page.keyboard.press('Escape');
  await sheet.waitFor({ state: 'detached' });
  await page
    .getByRole('link', { name: /^Decisions/ })
    .first()
    .click();
  await page.getByRole('heading', { name: 'Decisions', level: 1 }).waitFor({ timeout: 30000 });
  expect(reports.filter((text) => /use\(\)/.test(text))).toEqual([]);
}, 180000);
