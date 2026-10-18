import { chromium, type Browser, type Page } from 'playwright';
import { afterAll, beforeAll, expect, test, vi } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Card } from '@pitchcrew/core';
import { cleanup, setup } from '../../orchestrator/test/helpers/daemon.ts';

const viteCache = vi.hoisted(() => ({ directory: '' }));
vi.mock('vite', async (importOriginal) => {
  const vite = await importOriginal<typeof import('vite')>();
  return {
    ...vite,
    createServer: (config: import('vite').InlineConfig) =>
      vite.createServer({ ...config, cacheDir: viteCache.directory }),
  };
});
let host: Awaited<ReturnType<typeof setup>>;
let browser: Browser;
let page: Page;
const errors: string[] = [];
const starters = [
  'Research a company',
  'Improve my LinkedIn',
  'Prepare for an interview',
  'Practice with me',
  'Debrief an interview',
  'Plan my career',
  'Evaluate an offer',
];

beforeAll(async () => {
  viteCache.directory = await mkdtemp(join(tmpdir(), 'pitchcrew-career-ui-cache-'));
  host = await setup(19749);
  host.daemon.service.onboarding.save({ version: 1, status: 'dismissed', step: 0 });
  browser = await chromium.launch({ headless: true });
  page = await browser.newPage({ viewport: { width: 1280, height: 900 }, reducedMotion: 'reduce' });
  page.setDefaultTimeout(10000);
  page.on('pageerror', (error) => errors.push(error.message));
}, 60000);
afterAll(async () => {
  await browser?.close();
  await cleanup();
  if (viteCache.directory) await rm(viteCache.directory, { recursive: true, force: true });
});

test('offers all coaching activities with or without an attached job, fills the existing composer and fits mobile', async () => {
  await page.goto(`${host.daemon.url}/chat/career-coach`);
  await page
    .getByRole('heading', { name: 'Prepare for your next career step', exact: true })
    .waitFor({ timeout: 30000 });
  for (const label of starters)
    expect(await page.getByRole('button', { name: label, exact: true }).isVisible()).toBe(true);
  await page.getByRole('button', { name: 'Improve my LinkedIn', exact: true }).click();
  expect(await page.locator('textarea').inputValue()).toContain('measured length checks');
  await page.getByRole('button', { name: 'Research a company', exact: true }).click();
  expect(await page.locator('textarea').inputValue()).toContain('sourced brief');
  await page.getByRole('button', { name: 'Practice with me', exact: true }).click();
  expect(await page.locator('textarea').inputValue()).toContain('one question at a time');
  expect(host.daemon.service.board.list('run')).toEqual([]);
  const card = (
    await host.request<Card>('/cards', 'POST', {
      company: 'Example Works',
      title: 'Analyst',
      description: 'Fictional job for practice.',
    })
  ).result;
  expect(
    (await host.request('/conversations/career-coach', 'PUT', { cardId: card.id })).response.status,
  ).toBe(200);
  await page.reload();
  await page.getByRole('button', { name: 'Evaluate an offer', exact: true }).waitFor();
  await page.setViewportSize({ width: 390, height: 844 });
  for (const label of starters)
    expect(await page.getByRole('button', { name: label, exact: true }).isVisible()).toBe(true);
  await page.getByRole('button', { name: 'Evaluate an offer', exact: true }).click();
  expect(await page.locator('textarea').inputValue()).toContain('compensation and contract terms');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(errors).toEqual([]);
}, 60000);

test('offers Scout research with and without job context and keeps existing starters', async () => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto(`${host.daemon.url}/chat/scout`);
  for (const attached of [false, true]) {
    if (attached) {
      const card = host.daemon.service.board.list<Card>('card')[0];
      expect(
        (await host.request('/conversations/scout', 'PUT', { cardId: card.id })).response.status,
      ).toBe(200);
      await page.reload();
      await page.getByRole('button', { name: 'Evaluate this job', exact: true }).waitFor();
    }
    await page.getByRole('button', { name: 'Research a company', exact: true }).click();
    expect(await page.locator('textarea').inputValue()).toContain('sourced brief');
    expect(
      await page.getByRole('button', { name: 'What should I look for?', exact: true }).isVisible(),
    ).toBe(true);
    expect(
      await page.getByRole('button', { name: 'Improve my LinkedIn', exact: true }).count(),
    ).toBe(0);
  }
  expect(host.daemon.service.board.list('run')).toEqual([]);
  expect(errors).toEqual([]);
});
