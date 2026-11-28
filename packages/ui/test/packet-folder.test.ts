import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { chromium, type Browser, type Page } from 'playwright';
import { afterAll, beforeAll, expect, test } from 'vitest';
import type { Card } from '@pitchcrew/core';
import { cleanup, setup } from './helpers/daemon.ts';

let host: Awaited<ReturnType<typeof setup>>;
let browser: Browser;
let page: Page;
let card: Card;

beforeAll(async () => {
  host = await setup();
  browser = await chromium.launch({ headless: true });
  page = await browser.newPage({ viewport: { width: 1280, height: 800 }, reducedMotion: 'reduce' });
  page.setDefaultTimeout(10000);
  card = host.daemon.service.createCard({
    company: 'Fictional Studio',
    title: 'Design Engineer',
    url: 'https://example.com/fictional-job',
  });
  await page.goto(`${host.daemon.url}/pipeline`);
  await page.locator(`#board-job-${card.id} .clay-job-card`).waitFor({ timeout: 30000 });
  const later = page.getByRole('button', { name: 'Set up later', exact: true });
  if (await later.isVisible()) await later.click();
}, 60000);

afterAll(async () => {
  await browser?.close();
  await cleanup();
});

test('opens the packet folder from the control beside the posting link', async () => {
  const sheet = () => page.getByRole('dialog', { name: 'Job details', exact: true });
  const folderButton = () =>
    sheet().getByRole('button', { name: 'Open packet folder', exact: true });
  const posting = () =>
    sheet()
      .getByRole('link', { name: 'Open job posting', exact: true })
      .or(sheet().getByRole('button', { name: 'Open job posting', exact: true }));
  const openJob = async () => {
    const pending = page.waitForResponse(
      (response) =>
        response.url().includes(`/api/cards/${card.id}/packet-folder`) &&
        response.request().method() === 'GET' &&
        response.ok(),
    );
    await page.locator(`#board-job-${card.id} .clay-job-card`).click();
    const body = (await (await pending).json()) as { available: boolean };
    await sheet().getByRole('tab', { name: 'Job', exact: true }).waitFor();
    return body;
  };

  expect(await openJob()).toEqual({ available: false });
  await posting().waitFor();
  expect(await folderButton().count()).toBe(0);
  await sheet().getByRole('button', { name: 'Close dialog', exact: true }).click();
  await sheet().waitFor({ state: 'hidden' });

  await mkdir(join(host.directory, 'packets', card.id, 'try-ready'), { recursive: true });
  await writeFile(
    join(host.directory, 'packets', card.id, 'try-ready', 'resume.md'),
    'Fictional resume.',
  );
  expect(await openJob()).toEqual({ available: true });
  await folderButton().waitFor();
  const postingBox = (await posting().boundingBox())!;
  const folderBox = (await folderButton().boundingBox())!;
  expect(folderBox.x).toBeGreaterThan(postingBox.x);
  expect(folderBox.x - (postingBox.x + postingBox.width)).toBeLessThan(24);
  expect(Math.abs(folderBox.y - postingBox.y)).toBeLessThan(8);

  const posts: string[] = [];
  await page.route('**/api/cards/*/packet-folder', async (route) => {
    if (route.request().method() !== 'POST') {
      await route.continue();
      return;
    }
    posts.push(new URL(route.request().url()).pathname);
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ ok: true }),
    });
  });
  try {
    await folderButton().click();
    await expect.poll(() => posts).toEqual([`/api/cards/${card.id}/packet-folder`]);
  } finally {
    await page.unroute('**/api/cards/*/packet-folder');
  }
}, 30000);
