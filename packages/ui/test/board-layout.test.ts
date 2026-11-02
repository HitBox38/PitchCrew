import { chromium, type Browser, type Page } from 'playwright';
import { afterAll, beforeAll, expect, test } from 'vitest';
import type { UserInputRequest } from '@pitchcrew/core';
import { cleanup, setup } from './helpers/daemon.ts';

let host: Awaited<ReturnType<typeof setup>>;
let browser: Browser;
let page: Page;

beforeAll(async () => {
  host = await setup(14619);
  host.daemon.service.onboarding.save({ version: 1, status: 'dismissed', step: 0 });
  const conversation = host.daemon.service.createConversation({
    title: 'Layout question',
    participants: ['scout'],
  });
  const question: UserInputRequest = {
    id: 'layout-question',
    roleId: 'scout',
    runId: 'layout-run',
    cardId: null,
    threadId: conversation.id,
    sourceThreadId: conversation.id,
    messageId: 'layout-message',
    status: 'pending',
    question: 'Which location would you prefer?',
    options: [],
    reason: '',
    continuationNotes: '',
    multiSelect: false,
    createdAt: new Date().toISOString(),
  };
  host.daemon.service.board.record('user_input', question, 'scout', 'Fictional decision deck');
  for (let index = 0; index < 19; index++) {
    const card = host.daemon.service.createCard({
      company: `Layout Studio ${index}`,
      title: 'Engineer',
    });
    host.daemon.service.board.record(
      'card',
      { ...card, state: 'in_review' },
      'system',
      'Fictional layout fixture',
    );
  }
  browser = await chromium.launch({ headless: true });
  page = await browser.newPage({
    viewport: { width: 1442, height: 962 },
    reducedMotion: 'reduce',
  });
  await page.goto(host.daemon.url, { waitUntil: 'domcontentloaded' });
  await page.locator('#stage-progress .clay-column-count').waitFor({ timeout: 30000 });
  await page.evaluate(() => document.fonts.ready);
}, 60000);

afterAll(async () => {
  await browser?.close();
  await cleanup();
}, 30000);

const geometry = () =>
  page.evaluate(() => {
    const pipeline = document.querySelector('.clay-columns')!;
    const rect = (element: Element | Range) => {
      const { x, y, right, bottom, width, height } = element.getBoundingClientRect();
      return { x, y, right, bottom, width, height };
    };
    return {
      pipeline: { client: pipeline.clientWidth, scroll: pipeline.scrollWidth },
      document: {
        client: document.documentElement.clientWidth,
        scroll: document.documentElement.scrollWidth,
      },
      columns: Array.from(document.querySelectorAll('.clay-column'))
        .filter((column) => column.getBoundingClientRect().width > 0)
        .map((column) => {
          const heading = column.querySelector('h2')!;
          const count = column.querySelector('.clay-column-count')!;
          const beads = column.querySelector('.clay-column-beads')!;
          const sort = column.querySelector('.clay-column-sort')!;
          const titleRange = document.createRange();
          titleRange.selectNodeContents(heading.firstChild!);
          return {
            label: column.getAttribute('aria-label'),
            column: rect(column),
            header: rect(column.querySelector('.clay-column-heading')!),
            title: rect(titleRange),
            count: rect(count),
            beads: rect(beads),
            sort: rect(sort),
            beadSizes: Array.from(beads.children).map((bead) => rect(bead).width),
          };
        }),
    };
  });

const expectReadable = async () => {
  const measured = await geometry();
  for (const { label, column, header, title, count, beads, sort } of measured.columns) {
    const details = JSON.stringify({ label, column, header, title, count, beads, sort });
    for (const item of [title, count, sort]) {
      expect(item.x, details).toBeGreaterThanOrEqual(header.x - 1);
      expect(item.right, details).toBeLessThanOrEqual(header.right + 1);
      expect(item.y, details).toBeGreaterThanOrEqual(header.y - 1);
      expect(item.bottom, details).toBeLessThanOrEqual(header.bottom + 1);
    }
    const overlaps = (a: typeof title, b: typeof title) =>
      a.x < b.right && b.x < a.right && a.y < b.bottom && b.y < a.bottom;
    expect(overlaps(title, count), details).toBe(false);
    expect(overlaps(title, sort), details).toBe(false);
    expect(overlaps(count, sort), details).toBe(false);
    if (beads.width) {
      expect(overlaps(title, beads), details).toBe(false);
      expect(overlaps(count, beads), details).toBe(false);
      expect(overlaps(sort, beads), details).toBe(false);
    }
    expect(sort.width, details).toBeGreaterThanOrEqual(32);
  }
  expect(measured.document.scroll).toBeLessThanOrEqual(measured.document.client);
  const minimum = measured.columns.length === 5 ? 860 : measured.columns.length === 4 ? 800 : 0;
  expect(measured.pipeline.scroll, JSON.stringify(measured.pipeline)).toBe(
    Math.max(measured.pipeline.client, minimum),
  );
  return measured;
};

test('pipeline headers stay readable at the reported size, with either sidebar and large counts', async () => {
  for (const width of [1442, 2560, 1280, 1024, 800, 768]) {
    await page.setViewportSize({ width, height: 962 });
    for (const collapsed of [false, true]) {
      const sidebar = page.locator('[data-slot="sidebar"][data-state]');
      const state = collapsed ? 'collapsed' : 'expanded';
      if ((await sidebar.getAttribute('data-state')) !== state)
        await page
          .getByRole('button', { name: collapsed ? 'Hide sidebar' : 'Show sidebar', exact: true })
          .click();
      await expect.poll(() => sidebar.getAttribute('data-state')).toBe(state);
      for (const count of ['19', '9999', '123 of 9999']) {
        // Exercise extreme count strings without thousands of unrelated fixture cards.
        await page.locator('#stage-progress .clay-column-count').evaluate((element, value) => {
          element.textContent = value;
        }, count);
        const measured = await expectReadable();
        const progress = measured.columns.find((column) =>
          column.label?.startsWith('In progress'),
        )!;
        if (progress.column.width < 256) expect(progress.beads.width).toBe(0);
        else expect(progress.beadSizes).toEqual([8, 8, 8, 8, 8]);
      }
    }
  }
}, 30000);

test('phone stages retain readable counts and full touch targets without horizontal overflow', async () => {
  for (const width of [767, 390, 320]) {
    await page.setViewportSize({ width, height: 844 });
    await page.getByRole('combobox', { name: 'Board stage', exact: true }).click();
    await page.getByRole('option', { name: /In progress/ }).click();
    for (const count of ['19', '9999', '123 of 9999']) {
      await page.locator('#stage-progress .clay-column-count').evaluate((element, value) => {
        element.textContent = value;
      }, count);
      const measured = await expectReadable();
      expect(measured.columns).toHaveLength(1);
      expect(measured.columns[0].sort.width).toBeGreaterThanOrEqual(44);
      expect(measured.columns[0].sort.height).toBeGreaterThanOrEqual(44);
      expect(measured.pipeline.scroll).toBe(measured.pipeline.client);
    }
  }
});

test('sorting, paging, search and exact drag targets remain accessible in a tight column', async () => {
  for (let index = 19; index < 25; index++) {
    const card = host.daemon.service.createCard({
      company: `Layout Studio ${index}`,
      title: 'Engineer',
    });
    host.daemon.service.board.record(
      'card',
      { ...card, state: 'in_review' },
      'system',
      'Layout paging fixture',
    );
  }
  await page.setViewportSize({ width: 1442, height: 962 });
  await page.reload();
  const sidebar = page.locator('[data-slot="sidebar"][data-state]');
  await sidebar.waitFor();
  if ((await sidebar.getAttribute('data-state')) !== 'expanded')
    await page.getByRole('button', { name: 'Show sidebar', exact: true }).click();
  const progress = page.locator('#stage-progress');
  const sort = progress.getByRole('button', { name: /^Sort In progress:/ });
  await sort.focus();
  await page.keyboard.press('Enter');
  await page.getByRole('menuitemradio', { name: 'Company (A–Z)', exact: true }).press('Enter');
  await expect.poll(() => sort.getAttribute('aria-label')).toBe('Sort In progress: Company (A–Z)');
  await expect
    .poll(() => sort.evaluate((element) => element === document.activeElement))
    .toBe(true);
  const next = progress.getByRole('button', { name: 'Next In progress page', exact: true });
  await next.focus();
  await page.keyboard.press('Enter');
  await expect.poll(() => progress.locator('.draggable-job').count()).toBe(5);
  await page.getByRole('textbox', { name: 'Search jobs', exact: true }).fill('Layout Studio 2');
  await expect.poll(() => progress.locator('.clay-column-count').textContent()).toBe('6 of 25');
  await expectReadable();
  await page.getByRole('textbox', { name: 'Search jobs', exact: true }).press('Escape');

  const job = progress.locator('.clay-job-card').first();
  const box = (await job.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 15, box.y + box.height / 2, { steps: 5 });
  await page.locator('.clay-columns[data-dragging]').waitFor();
  expect(await page.locator('.status-drop-target').count()).toBe(14);
  await expectReadable();
  await page.keyboard.press('Escape');
  await page.mouse.up();
  await page.locator('.clay-columns[data-dragging]').waitFor({ state: 'hidden' });
});
