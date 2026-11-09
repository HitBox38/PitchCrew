import type { Card } from '@pitchcrew/core';
import { chromium, type Browser, type Page } from 'playwright';
import { afterAll, beforeAll, expect, test } from 'vitest';
import { cleanup, setup } from './helpers/daemon.ts';

let host: Awaited<ReturnType<typeof setup>>;
let browser: Browser;
let page: Page;
let card: Card;
/** While set, every newly requested lazy JavaScript chunk fails like a stale or missing file. */
let blocking = false;
const blocked: string[] = [];
let reloads = 0;

beforeAll(async () => {
  host = await setup(14783);
  host.daemon.service.onboarding.save({ version: 1, status: 'dismissed', step: 0 });
  ({ result: card } = await host.request<Card>('/cards', 'POST', {
    company: 'Recovery Fixture (fictional)',
    title: 'Interface Engineer',
    description: 'Build interfaces.',
  }));
  browser = await chromium.launch({ headless: true });
  page = await browser.newPage({ viewport: { width: 1280, height: 900 }, reducedMotion: 'reduce' });
  await page.route('**/assets/*.js', async (route) => {
    if (!blocking) return route.continue();
    blocked.push(new URL(route.request().url()).pathname);
    return route.abort('failed');
  });
  page.on('request', (request) => {
    if (request.isNavigationRequest() && request.frame() === page.mainFrame()) reloads += 1;
  });
  await page.goto(host.daemon.url);
  await page.locator(`#board-job-${card.id} .clay-job-card`).waitFor({ timeout: 30000 });
  reloads = 0;
}, 60000);

afterAll(async () => {
  await browser?.close();
  await cleanup();
});

test('a page that fails to load keeps the workspace and recovers only through a confirmed reload', async () => {
  const documentOrigin = await page.evaluate(() => performance.timeOrigin);
  blocking = true;
  await page
    .getByRole('link', { name: /^Decisions/ })
    .first()
    .click();
  const failure = page.getByRole('alert').filter({ hasText: 'This page didn’t load' });
  await failure.waitFor({ timeout: 15000 });
  expect(blocked.length).toBeGreaterThan(0);
  // The shell stays, nothing reloaded on its own, and no raw router error or address shows.
  expect(await page.getByRole('banner', { name: 'Workspace controls' }).count()).toBe(1);
  expect(await page.getByText('Something went wrong!').count()).toBe(0);
  expect(await failure.innerText()).not.toMatch(/dynamically imported|\/assets\//);
  // Chromium keeps a failed module graph for the window's life, so Try again is not offered.
  expect(await failure.getByRole('button', { name: 'Try again' }).count()).toBe(0);
  await failure.getByRole('button', { name: 'Technical details' }).click();
  await failure.getByLabel('Error details', { exact: true }).waitFor();
  expect(reloads).toBe(0);
  expect(await page.evaluate(() => performance.timeOrigin)).toBe(documentOrigin);

  blocking = false;
  await failure.getByRole('button', { name: 'Reload Pitchcrew…' }).click();
  await failure.getByText(/Unsent messages and unsaved edits in this window are lost/).waitFor();
  await failure.getByRole('button', { name: 'Reload', exact: true }).click();
  await page.getByRole('heading', { name: 'Decisions', level: 1 }).waitFor({ timeout: 30000 });
  expect(reloads).toBe(1);
});

test('a job sheet that fails to load closes without taking down the workspace', async () => {
  await page
    .getByRole('link', { name: /^Board/ })
    .first()
    .click();
  const job = page.locator(`#board-job-${card.id} .clay-job-card`);
  await job.waitFor({ timeout: 30000 });
  reloads = 0;
  blocking = true;
  await job.click();
  const dialog = page.getByRole('dialog', { name: 'Job details didn’t load' });
  await dialog.waitFor({ timeout: 15000 });
  await dialog.getByRole('button', { name: 'Reload Pitchcrew…' }).click();
  await dialog.getByRole('button', { name: 'Keep this window' }).click();
  await dialog.getByRole('button', { name: 'Close', exact: true }).click();
  await dialog.waitFor({ state: 'detached' });
  // Board and the app bar keep working after the failed sheet closes.
  await job.waitFor();
  expect(await page.getByRole('banner', { name: 'Workspace controls' }).count()).toBe(1);
  expect(reloads).toBe(0);
  blocking = false;
});
