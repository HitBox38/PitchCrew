import { chromium, type Browser, type Page } from 'playwright';
import { afterAll, beforeAll, beforeEach, expect, test } from 'vitest';
import type { Card } from '@pitchcrew/core';
import { cleanup, setup } from './helpers/daemon.ts';
let host: Awaited<ReturnType<typeof setup>>;
let browser: Browser;
let page: Page;
let card: Card;
const errors: string[] = [];
beforeAll(async () => {
  host = await setup(14659);
  browser = await chromium.launch({ headless: true });
  page = await browser.newPage({ viewport: { width: 1280, height: 800 }, reducedMotion: 'reduce' });
  page.setDefaultTimeout(10000);
  page.on('pageerror', (error) => errors.push(error.message));
}, 60000);
beforeEach(async () => {
  card = host.daemon.service.createCard({
    company: 'Fictional Studio',
    title: 'Design Engineer',
    description: 'Build accessible interfaces.',
    location: 'Berlin',
    salary: '€80k',
    url: 'https://example.com/fictional-job',
    tags: ['design'],
  });
  await page.goto(host.daemon.url);
  await page.locator(`#board-job-${card.id} .job-card`).waitFor({ timeout: 30000 });
  const later = page.getByRole('button', { name: 'Set up later', exact: true });
  if (await later.isVisible()) await later.click();
  await page.locator(`#board-job-${card.id} .job-card`).click();
  await page.getByRole('button', { name: 'Edit job', exact: true }).click();
  await page.getByRole('dialog', { name: 'Edit job', exact: true }).waitFor();
}, 30000);
afterAll(async () => {
  await browser?.close();
  await cleanup();
});

test('prefills the shared form and saves every field to the same job', async () => {
  const editor = page.getByRole('dialog', { name: 'Edit job', exact: true });
  for (const [name, value] of Object.entries({
    company: card.company,
    title: card.title,
    location: card.location,
    salary: card.salary,
    description: card.description,
    url: card.url,
  })) {
    expect(await editor.locator(`[name=${name}]`).inputValue()).toBe(value);
  }
  expect(
    await editor.getByRole('checkbox', { name: 'Already applied outside Pitchcrew' }).count(),
  ).toBe(0);
  expect(await editor.getByRole('button', { name: 'Ask Scout to add job' }).count()).toBe(0);
  expect(await editor.getByLabel('Selected tags').innerText()).toContain('design');
  await editor.getByRole('textbox', { name: 'Company', exact: true }).fill('Updated Studio');
  await editor
    .getByRole('textbox', { name: 'Role title', exact: true })
    .fill('Senior Design Engineer');
  await editor.getByRole('textbox', { name: 'Location', exact: true }).fill('');
  await editor.getByRole('textbox', { name: 'Salary range optional', exact: true }).fill('$100k');
  await editor.getByRole('textbox', { name: 'Job post URL optional', exact: true }).fill('');
  await editor
    .getByRole('textbox', { name: 'Job description', exact: true })
    .fill('Updated description.');
  await editor.getByRole('combobox', { name: 'Tags', exact: true }).fill('priority');
  await page.getByRole('option', { name: 'Add “priority”', exact: true }).click();
  await editor.getByRole('button', { name: 'Save changes', exact: true }).click();
  await expect.poll(() => editor.count()).toBe(0);
  const saved = host.daemon.service.board.get<Card>('card', card.id);
  expect(saved).toMatchObject({
    company: 'Updated Studio',
    title: 'Senior Design Engineer',
    location: '',
    salary: '$100k',
    url: '',
    description: 'Updated description.',
    tags: ['design', 'priority'],
    state: card.state,
    createdAt: card.createdAt,
  });
  expect(
    host.daemon.service.board.list<Card>('card').filter((job) => job.id === card.id),
  ).toHaveLength(1);
  const details = page.getByRole('dialog', { name: 'Job details', exact: true });
  await details.getByRole('heading', { name: 'Senior Design Engineer', exact: true }).waitFor();
  await details.getByText('Updated description.', { exact: true }).waitFor();
  await details.getByRole('button', { name: 'Close dialog', exact: true }).click();
  expect(await page.locator(`#board-job-${card.id}`).innerText()).toContain('Updated Studio');
  expect(errors).toEqual([]);
});

test('guards cancellation, preserves the draft and fits the mobile viewport', async () => {
  await page.setViewportSize({ width: 390, height: 844 });
  const editor = page.getByRole('dialog', { name: 'Edit job', exact: true });
  await editor.getByRole('textbox', { name: 'Company', exact: true }).fill('Unsaved Studio');
  await editor.getByRole('button', { name: 'Cancel', exact: true }).click();
  await page.getByRole('button', { name: 'Keep editing', exact: true }).click();
  expect(await editor.getByRole('textbox', { name: 'Company', exact: true }).inputValue()).toBe(
    'Unsaved Studio',
  );
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  const footer = await editor
    .getByRole('button', { name: 'Save changes', exact: true })
    .boundingBox();
  expect(footer!.y + footer!.height).toBeLessThanOrEqual(844);
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Discard changes', exact: true }).click();
  await expect.poll(() => editor.count()).toBe(0);
  expect(host.daemon.service.board.get<Card>('card', card.id)).toEqual(card);
  await page.setViewportSize({ width: 1280, height: 800 });
  expect(errors).toEqual([]);
});

test('keeps the draft open after a conflicting save and protects the concurrent change', async () => {
  const editor = page.getByRole('dialog', { name: 'Edit job', exact: true });
  await editor.getByRole('textbox', { name: 'Company', exact: true }).fill('My Draft');
  const concurrent = {
    ...card,
    company: 'Concurrent Studio',
    updatedAt: new Date(Date.now() + 1000).toISOString(),
  };
  host.daemon.service.board.record('card', concurrent, 'user', 'Fixture concurrent change');
  await editor.getByRole('button', { name: 'Save changes', exact: true }).click();
  await editor
    .getByRole('alert')
    .getByText('This job changed while you were editing. Reopen the editor to review it.')
    .waitFor();
  expect(await editor.getByRole('textbox', { name: 'Company', exact: true }).inputValue()).toBe(
    'My Draft',
  );
  expect(host.daemon.service.board.get<Card>('card', card.id)).toEqual(concurrent);
  expect(errors).toEqual([]);
});

test('fetches posting details for review without warning about the edited job or creating another', async () => {
  await page.route('**/api/jobs/lookup', async (route) =>
    route.fulfill({
      json: {
        status: 'found',
        prefill: {
          company: 'Fetched Studio',
          title: 'Fetched Engineer',
          location: 'Remote',
          salary: '$120k',
          url: card.url,
          description: 'Fetched description.',
          jobIdentifier: '123',
          provenance: { provider: 'greenhouse', board: 'fixture', jobId: '123', postedAt: null },
        },
        duplicates: [{ id: card.id, company: card.company, title: card.title, state: card.state }],
      },
    }),
  );
  const editor = page.getByRole('dialog', { name: 'Edit job', exact: true });
  await editor.getByRole('button', { name: 'Fetch from link', exact: true }).click();
  await editor
    .getByText('Filled from the posting. Review the details before you save changes.', {
      exact: true,
    })
    .waitFor();
  expect(await editor.getByRole('textbox', { name: 'Company', exact: true }).inputValue()).toBe(
    'Fetched Studio',
  );
  expect(
    await editor.getByText('This job may already be on the board:', { exact: true }).count(),
  ).toBe(0);
  await editor.getByRole('button', { name: 'Save changes', exact: true }).click();
  await expect.poll(() => editor.count()).toBe(0);
  expect(host.daemon.service.board.get<Card>('card', card.id)).toMatchObject({
    company: 'Fetched Studio',
    description: 'Fetched description.',
  });
  await page.unroute('**/api/jobs/lookup');
  expect(errors).toEqual([]);
});

test('continues to add new jobs with the shared form', async () => {
  await page
    .getByRole('dialog', { name: 'Edit job', exact: true })
    .getByRole('button', { name: 'Cancel', exact: true })
    .click();
  await page
    .getByRole('dialog', { name: 'Job details', exact: true })
    .getByRole('button', { name: 'Close dialog', exact: true })
    .click();
  await page.getByRole('button', { name: 'Add job', exact: true }).click();
  const form = page.getByRole('dialog', { name: 'Add a job post', exact: true });
  expect(await form.getByRole('textbox', { name: 'Company', exact: true }).inputValue()).toBe('');
  expect(await form.getByRole('textbox', { name: 'Location', exact: true }).inputValue()).toBe(
    'Remote',
  );
  await form.getByRole('textbox', { name: 'Company', exact: true }).fill('New Fixture');
  await form.getByRole('textbox', { name: 'Role title', exact: true }).fill('New Engineer');
  await form.getByRole('button', { name: 'Add job', exact: true }).click();
  await expect.poll(() => form.count()).toBe(0);
  expect(
    host.daemon.service.board
      .list<Card>('card')
      .some((job) => job.company === 'New Fixture' && job.id !== card.id),
  ).toBe(true);
  expect(errors).toEqual([]);
});
