import { chromium, type Browser, type Page } from 'playwright';
import { afterAll, beforeAll, beforeEach, expect, test, vi } from 'vitest';
import { adapters } from '../../adapters/src/index.ts';
import type { Card, RunContext, Run } from '@pitchcrew/core';
import { cleanup, confirmFixtureApplication, finish, setup } from './helpers/daemon.ts';
let host: Awaited<ReturnType<typeof setup>>;
let browser: Browser;
let page: Page;
let card: Card;
const errors: string[] = [];
beforeAll(async () => {
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

test('opens Writing settings from the redesigned application documents and closes the job sheet', async () => {
  await page.getByRole('tab', { name: 'Application', exact: true }).click();
  await page.getByRole('button', { name: /^Documents/ }).click();
  await page.getByRole('button', { name: 'Writing guide', exact: true }).click();
  await page.getByRole('heading', { name: 'Writing guide', exact: true }).waitFor();
  expect(new URL(page.url()).searchParams.get('section')).toBe('writing');
  await expect
    .poll(() => page.getByRole('dialog', { name: 'Job details', exact: true }).count())
    .toBe(0);
  expect(errors).toEqual([]);
});

test('shows the job identity and a loading skeleton while its source is opening', async ({
  onTestFinished,
}) => {
  await page.getByRole('button', { name: 'Close dialog', exact: true }).click();
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const sourceUrl = `${host.daemon.url}/api/cards/${card.id}`;
  await page.route(sourceUrl, async (route) => {
    await gate;
    await route.continue();
  });
  onTestFinished(async () => {
    release();
    await page.unroute(sourceUrl);
  });
  await page.locator(`#board-job-${card.id} .job-card`).click();
  const sheet = page.getByRole('dialog', { name: 'Job details', exact: true });
  await sheet.getByText('Opening job…', { exact: true }).waitFor();
  expect(await sheet.getByRole('heading', { name: card.title, exact: true }).isVisible()).toBe(
    true,
  );
  expect(await sheet.locator('[aria-busy=true] [data-slot=skeleton]').count()).toBeGreaterThan(0);
  release();
  await sheet.getByRole('tab', { name: 'Job', exact: true }).waitFor();
});

test('acknowledges agent startup before the request completes, shares it with the board and recovers on failure', async ({
  onTestFinished,
}) => {
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const launchUrl = `${host.daemon.url}/api/queue/actions`;
  await page.route(launchUrl, async (route) => {
    await gate;
    await route.fulfill({ status: 409, json: { error: 'Fictional startup failed' } });
  });
  onTestFinished(async () => {
    release();
    await page.unroute(launchUrl);
  });
  const sheet = page.getByRole('dialog', { name: 'Job details', exact: true });
  await sheet.getByRole('button', { name: 'Draft application', exact: true }).click();
  const starting = sheet.getByRole('button', { name: 'Starting agent…', exact: true });
  await starting.waitFor();
  expect(await starting.isDisabled()).toBe(true);
  expect(await starting.locator('svg').count()).toBe(1);
  await sheet.getByRole('button', { name: 'Close dialog', exact: true }).click();
  const job = page.locator(`#board-job-${card.id}`);
  await job.getByRole('status').getByText('Starting agent…', { exact: true }).waitFor();
  release();
  await page.getByText('Fictional startup failed', { exact: true }).waitFor();
  await expect.poll(() => job.getByRole('status').count()).toBe(0);
  await job.locator('.job-card').click();
  await page.getByRole('button', { name: 'Draft application', exact: true }).waitFor();
  expect(errors).toEqual([]);
});

test('shows immediate feedback on a stage button and in the sheet header until the move finishes', async ({
  onTestFinished,
}) => {
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const moveUrl = `${host.daemon.url}/api/cards/${card.id}/move`;
  await page.route(moveUrl, async (route) => {
    await gate;
    await route.continue();
  });
  onTestFinished(async () => {
    release();
    await page.unroute(moveUrl);
  });
  const sheet = page.getByRole('dialog', { name: 'Job details', exact: true });
  await sheet.getByRole('tab', { name: 'Activity', exact: true }).click();
  await sheet.getByRole('button', { name: 'Withdrawn', exact: true }).click();
  const moving = sheet.getByRole('button', { name: 'Moving…', exact: true });
  await moving.waitFor();
  expect(await moving.isDisabled()).toBe(true);
  expect(await moving.locator('svg.spin').count()).toBe(1);
  await sheet.getByRole('status').getByText('Moving to Withdrawn…', { exact: true }).waitFor();
  expect(host.daemon.service.board.get<Card>('card', card.id).state).toBe('shortlisted');
  release();
  await sheet.locator('.detail-state .state-pill.withdrawn').waitFor();
  expect(host.daemon.service.board.get<Card>('card', card.id).state).toBe('withdrawn');
});
