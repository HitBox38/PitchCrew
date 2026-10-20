import { chromium, type Browser, type Page } from 'playwright';
import { afterAll, beforeAll, beforeEach, expect, test, vi } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { adapters } from '../../adapters/src/index.ts';
import type { Card, RunContext, Run } from '@pitchcrew/core';
import {
  cleanup,
  confirmFixtureApplication,
  finish,
  setup,
} from '../../orchestrator/test/helpers/daemon.ts';
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
let card: Card;
const errors: string[] = [];
beforeAll(async () => {
  viteCache.directory = await mkdtemp(join(tmpdir(), 'pitchcrew-job-details-cache-'));
  host = await setup(14631);
  await host.daemon.service.saveProfile(
    'experience.md',
    '# Experience\n\n- Built fictional React interfaces.',
  );
  browser = await chromium.launch({ headless: true });
  page = await browser.newPage({ viewport: { width: 1280, height: 800 }, reducedMotion: 'reduce' });
  page.setDefaultTimeout(10000);
  page.on('pageerror', (error) => errors.push(error.message));
}, 60000);
beforeEach(async () => {
  card = host.daemon.service.createCard({
    company: 'Fictional Studio',
    title: 'Design Engineer',
    description: 'Build accessible interfaces and reusable components.',
    location: 'Berlin · Hybrid',
    salary: '€80k–€100k',
    url: 'https://example.com/fictional-job',
  });
  host.daemon.service.moveCard(card.id, 'shortlisted');
  await confirmFixtureApplication(host.request, card.id);
  await page.goto(host.daemon.url);
  await page.locator(`#board-job-${card.id} .job-card`).waitFor({ timeout: 30000 });
  const later = page.getByRole('button', { name: 'Set up later', exact: true });
  if (await later.isVisible()) await later.click();
  await page.locator(`#board-job-${card.id} .job-card`).click();
  await page.getByRole('tab', { name: 'Job', exact: true }).waitFor();
}, 30000);
afterAll(async () => {
  await browser?.close();
  await cleanup();
  if (viteCache.directory) await rm(viteCache.directory, { recursive: true, force: true });
});
test('puts the role first, defers reviews and preserves the compact layout on mobile', async () => {
  const sheet = page.getByRole('dialog', { name: 'Job details', exact: true });
  expect(await sheet.getByRole('tab').allTextContents()).toEqual([
    'Job',
    'Application',
    'Activity',
  ]);
  expect(await sheet.getByRole('heading', { name: 'About the role' }).isVisible()).toBe(true);
  const description = await sheet.getByRole('heading', { name: 'About the role' }).boundingBox();
  expect(description!.y).toBeLessThan(300);
  expect(await sheet.getByRole('button', { name: 'Draft application', exact: true }).count()).toBe(
    1,
  );
  expect(await sheet.getByRole('textbox', { name: 'New lesson' }).count()).toBe(0);
  await sheet.getByRole('tab', { name: 'Application', exact: true }).click();
  expect(await sheet.getByRole('button', { name: 'Draft application', exact: true }).count()).toBe(
    1,
  );
  expect(
    await sheet.getByRole('heading', { name: 'Deep resume reviews', exact: true }).count(),
  ).toBe(0);
  await sheet.getByRole('button', { name: 'Brief and requirements Confirmed' }).click();
  expect(await sheet.getByRole('button', { name: 'Review or edit brief' }).isVisible()).toBe(true);
  await page.setViewportSize({ width: 390, height: 844 });
  await sheet.getByRole('tab', { name: 'Job', exact: true }).click();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  const footer = await sheet
    .getByRole('button', { name: 'Draft application', exact: true })
    .boundingBox();
  expect(footer!.y + footer!.height).toBeLessThanOrEqual(844);
  await page.setViewportSize({ width: 1280, height: 800 });
  expect(errors).toEqual([]);
});
test('retains lesson and identifier drafts across sections and protects closing until saved', async () => {
  await page.getByRole('tab', { name: 'Activity', exact: true }).click();
  await page.getByRole('button', { name: 'What you learned', exact: true }).click();
  const lesson = page.getByRole('textbox', { name: 'New lesson', exact: true });
  await lesson.fill('Keep this draft across tabs.');
  await page.getByRole('tab', { name: 'Job', exact: true }).click();
  await page.getByRole('tab', { name: 'Application', exact: true }).click();
  await page.getByRole('tab', { name: 'Activity', exact: true }).click();
  expect(await lesson.inputValue()).toBe('Keep this draft across tabs.');
  await page.getByRole('button', { name: 'Close dialog', exact: true }).click();
  await page.getByRole('button', { name: 'Keep editing', exact: true }).click();
  expect(await lesson.inputValue()).toBe('Keep this draft across tabs.');
  await page.getByRole('button', { name: 'Add lesson', exact: true }).click();
  await expect.poll(() => lesson.inputValue()).toBe('');
  await page.getByRole('button', { name: 'Tracking evidence', exact: true }).click();
  const identifier = page.getByRole('textbox', { name: 'Job identifier', exact: true });
  await identifier.fill('REQ-2048');
  await page.getByRole('tab', { name: 'Job', exact: true }).click();
  await page.getByRole('tab', { name: 'Activity', exact: true }).click();
  expect(await identifier.inputValue()).toBe('REQ-2048');
  await page.getByRole('button', { name: 'Save identifier', exact: true }).click();
  await expect
    .poll(() => host.daemon.service.board.get<Card>('card', card.id).tracking?.jobIdentifier)
    .toBe('REQ-2048');
  await page.getByText('Job identifier saved', { exact: true }).waitFor();
  await page.getByRole('button', { name: 'Close dialog', exact: true }).click();
  await expect
    .poll(() => page.getByRole('dialog', { name: 'Job details', exact: true }).count())
    .toBe(0);
  expect(errors).toEqual([]);
});
test('previews the live workflow turn and opens that exact job chat without cancelling it', async ({
  onTestFinished,
}) => {
  let context: RunContext | undefined;
  let release!: () => void;
  const original = adapters.demo.run;
  const spy = vi.spyOn(adapters.demo, 'run').mockImplementation(async (turn) => {
    context = turn;
    turn.onActivity?.({
      id: 'note',
      kind: 'commentary',
      label: 'Progress',
      text: 'Checking the confirmed brief.',
      status: 'completed',
    });
    turn.onActivity?.({
      id: 'tool',
      kind: 'tool',
      label: 'Reading profile',
      text: 'PRIVATE TOOL PAYLOAD',
      status: 'running',
    });
    await new Promise<void>((resolve) => {
      release = resolve;
      turn.signal.addEventListener('abort', () => resolve(), { once: true });
    });
    return original(turn);
  });
  onTestFinished(() => {
    release?.();
    spy.mockRestore();
  });
  await page.getByRole('button', { name: 'Draft application', exact: true }).click();
  await expect.poll(() => Boolean(context)).toBe(true);
  const avatar = page.getByRole('link', { name: 'Writer: Running. Open job chat', exact: true });
  await avatar.waitFor();
  await avatar.hover();
  await page
    .locator('[data-slot=tooltip-content]')
    .getByText('Checking the confirmed brief.', { exact: true })
    .waitFor();
  expect(await page.locator('[data-slot=tooltip-content]').innerText()).toContain(
    'Reading profile',
  );
  expect(await page.locator('[data-slot=tooltip-content]').innerText()).not.toContain('PRIVATE');
  const run = host.daemon.service.board
    .list<Run>('run')
    .find((run) => run.cardId === card.id && run.status === 'running')!;
  await avatar.click();
  await page.waitForURL(`**/chat/${run.threadId}?run=${run.id}`);
  await page.locator(`#run-${run.id}`).waitFor();
  expect(host.daemon.service.board.get<Run>('run', run.id).status).toBe('running');
  await expect
    .poll(() => page.getByRole('dialog', { name: 'Job details', exact: true }).count())
    .toBe(0);
  context!.onActivity!({
    id: 'note-2',
    kind: 'commentary',
    label: 'Progress',
    text: 'Matching the draft to the role.',
    status: 'completed',
  });
  await page.getByText('Matching the draft to the role.', { exact: true }).waitFor();
  release();
  await finish(host.request, run.id);
  await page.reload();
  await page.locator(`#run-${run.id}`).waitFor({ timeout: 30000 });
  expect(await page.locator(`#run-${run.id}`).innerText()).toContain(
    'Matching the draft to the role.',
  );
  expect(errors).toEqual([]);
}, 30000);
