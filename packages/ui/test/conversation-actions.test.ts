import { chromium, type Browser, type Page } from 'playwright';
import { afterAll, beforeAll, expect, test, vi } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Conversation } from '@pitchcrew/core';
import { setup, cleanup } from '../../orchestrator/test/helpers/daemon.ts';

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
let conversation: Conversation;
const errors: string[] = [];
const menu = () =>
  page.getByRole('button', { name: `Actions for ${conversation.title}`, exact: true });

beforeAll(async () => {
  viteCache.directory = await mkdtemp(join(tmpdir(), 'pitchcrew-conversation-ui-cache-'));
  host = await setup(14639);
  conversation = host.daemon.service.createConversation({
    title: 'Fictional sidebar topic',
    participants: ['scout'],
  });
  browser = await chromium.launch({ headless: true });
  page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  page.setDefaultTimeout(10000);
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(host.daemon.url, { waitUntil: 'domcontentloaded' });
  await page
    .locator(`#conversation-actions-${conversation.id}`)
    .waitFor({ state: 'attached', timeout: 30000 });
  const later = page.getByRole('button', { name: 'Set up later', exact: true });
  if (await later.isVisible()) await later.click();
}, 60000);

afterAll(async () => {
  await browser?.close();
  await cleanup();
  if (viteCache.directory) await rm(viteCache.directory, { recursive: true, force: true });
});

test('right-click conversation actions preserve the page and retain deletion confirmation', async () => {
  const link = () => page.getByRole('link', { name: conversation.title, exact: true });
  await link().click({ button: 'right' });
  await page.getByRole('menu', { name: 'Conversation actions', exact: true }).waitFor();
  expect(await page.getByRole('menu', { name: 'Workspace actions', exact: true }).count()).toBe(0);
  await page.getByRole('menuitem', { name: 'Archive conversation', exact: true }).click();
  await expect.poll(() => menu().count()).toBe(0);
  expect(new URL(page.url()).pathname).toBe('/');
  await page.getByRole('button', { name: 'Show archived', exact: true }).click();
  await link().click({ button: 'right' });
  await page.getByRole('menuitem', { name: 'Restore conversation', exact: true }).click();
  await expect
    .poll(
      () => host.daemon.service.board.get<Conversation>('conversation', conversation.id).archived,
    )
    .toBe(false);
  await page.getByRole('button', { name: 'Hide archived', exact: true }).click();
  await link().click({ button: 'right' });
  await page.getByRole('menuitem', { name: 'Delete conversation', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Delete this conversation?' });
  const keep = dialog.getByRole('button', { name: 'Keep conversation' });
  await expect
    .poll(() => keep.evaluate((element) => element === document.activeElement))
    .toBe(true);
  await keep.click();
  await dialog.waitFor({ state: 'detached' });
  await expect
    .poll(() => menu().evaluate((element) => element === document.activeElement))
    .toBe(true);
});

test('archives and restores from the sidebar without navigating, then confirms deletion of the selected chat', async () => {
  await menu().focus();
  await page.keyboard.press('Enter');
  await page.getByRole('menuitem', { name: 'Archive conversation', exact: true }).click();
  await expect.poll(() => menu().count()).toBe(0);
  expect(new URL(page.url()).pathname).toBe('/');
  await page.getByRole('button', { name: 'Show archived', exact: true }).click();
  await menu().click();
  await page.getByRole('menuitem', { name: 'Restore conversation', exact: true }).click();
  await expect
    .poll(
      () => host.daemon.service.board.get<Conversation>('conversation', conversation.id).archived,
    )
    .toBe(false);
  await page.getByRole('button', { name: 'Hide archived', exact: true }).click();
  await page.getByRole('link', { name: conversation.title, exact: true }).click();
  await expect.poll(() => new URL(page.url()).pathname).toBe(`/chat/${conversation.id}`);
  await menu().click();
  await page.getByRole('menuitem', { name: 'Delete conversation', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Delete this conversation?' });
  await dialog.waitFor();
  expect(
    await dialog
      .getByRole('button', { name: 'Keep conversation' })
      .evaluate((element) => element === document.activeElement),
  ).toBe(true);
  await dialog.getByRole('button', { name: 'Keep conversation' }).click();
  await expect.poll(() => dialog.count()).toBe(0);
  await expect
    .poll(() => menu().evaluate((element) => element === document.activeElement))
    .toBe(true);
  expect(host.daemon.service.board.get<Conversation>('conversation', conversation.id)).toBeTruthy();
  await menu().click();
  await page.getByRole('menuitem', { name: 'Delete conversation', exact: true }).click();
  await dialog.getByRole('button', { name: 'Delete conversation', exact: true }).click();
  await expect.poll(() => menu().count()).toBe(0);
  await expect.poll(() => new URL(page.url()).pathname).toBe('/');
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.getByRole('navigation', { name: 'Conversations', exact: true }).waitFor();
  expect(await menu().count()).toBe(0);
  expect(errors).toEqual([]);
}, 45000);

test('starts a new role conversation after deletion and reuses it from Crew', async () => {
  expect((await host.request('/conversations/scout', 'DELETE')).response.status).toBe(200);
  await page.goto(`${host.daemon.url}/chat/scout`, { waitUntil: 'domcontentloaded' });
  await page.getByText('This conversation does not exist.', { exact: true }).waitFor();
  await page.getByText('New conversation', { exact: true }).click();
  await expect.poll(() => new URL(page.url()).pathname).toMatch(/^\/chat\/[0-9a-f-]{36}$/);
  const replacement = new URL(page.url()).pathname;
  await page.goto(`${host.daemon.url}/crew`, { waitUntil: 'domcontentloaded' });
  const card = page
    .locator('.crew-card')
    .filter({ has: page.getByRole('heading', { name: 'Scout', exact: true }) });
  await card.getByRole('button', { name: 'Chat', exact: true }).click();
  await expect.poll(() => new URL(page.url()).pathname).toBe(replacement);
  const id = new URL(page.url()).pathname.split('/').at(-1)!;
  expect(host.daemon.service.board.get<Conversation>('conversation', id).participants).toEqual([
    'scout',
  ]);
  expect(() => host.daemon.service.board.get('conversation', 'scout')).toThrow('not found');
});

test('keeps mobile conversation actions available and reports a failed deletion without removing the chat', async () => {
  conversation = host.daemon.service.createConversation({
    title: 'Fictional mobile topic',
    participants: ['writer'],
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: 'Toggle Sidebar', exact: true }).click();
  await menu().waitFor();
  await menu().click();
  await page.getByRole('menuitem', { name: 'Delete conversation', exact: true }).click();
  await page.route(`**/api/conversations/${conversation.id}`, (route) =>
    route.fulfill({
      status: 400,
      contentType: 'application/json',
      body: JSON.stringify({ error: 'Stop active work first.' }),
    }),
  );
  const dialog = page.getByRole('dialog', { name: 'Delete this conversation?' });
  await dialog.getByRole('button', { name: 'Delete conversation', exact: true }).click();
  await page.getByText('Stop active work first.', { exact: true }).waitFor();
  expect(await dialog.isVisible()).toBe(true);
  expect(host.daemon.service.board.get<Conversation>('conversation', conversation.id)).toBeTruthy();
  await page.unrouteAll({ behavior: 'wait' });
  await dialog.getByRole('button', { name: 'Keep conversation' }).click();
  expect(errors).toEqual([]);
}, 30000);
