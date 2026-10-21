import { chromium, type Browser, type Page } from 'playwright';
import { afterAll, beforeAll, beforeEach, expect, test, vi } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { setup, cleanup } from '../../orchestrator/test/helpers/daemon.ts';
import { viewTitles } from '../src/AppSidebar/constants.ts';
import { viewPaths } from '../src/navigation.ts';

const cache = vi.hoisted(() => ({ directory: '' }));
vi.mock('vite', async (importOriginal) => {
  const vite = await importOriginal<typeof import('vite')>();
  return {
    ...vite,
    createServer: (config: import('vite').InlineConfig) =>
      vite.createServer({ ...config, cacheDir: cache.directory }),
  };
});
let host: Awaited<ReturnType<typeof setup>>;
let browser: Browser;
let page: Page;
const errors: string[] = [];
const workspaceMenu = () => page.getByRole('menu', { name: 'Workspace actions', exact: true });
const openMenu = () =>
  page.locator('#main > .page').click({ button: 'right', position: { x: 10, y: 10 } });

beforeAll(async () => {
  cache.directory = await mkdtemp(join(tmpdir(), 'pitchcrew-context-ui-cache-'));
  host = await setup(14649);
  host.daemon.service.createCard({ company: 'Fictional Menu Studio', title: 'Engineer' });
  browser = await chromium.launch({ headless: true });
  page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  page.setDefaultTimeout(10000);
  page.on('pageerror', (error) => errors.push(error.message));
  await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
}, 60000);
beforeEach(async () => {
  await page.goto(host.daemon.url, { waitUntil: 'domcontentloaded' });
  await page.locator('.job-actions-trigger').first().waitFor({ timeout: 30000 });
  const later = page.getByRole('button', { name: 'Set up later', exact: true });
  if (await later.isVisible()) await later.click();
}, 40000);
afterAll(async () => {
  await browser?.close();
  await cleanup();
  if (cache.directory) await rm(cache.directory, { recursive: true, force: true });
});

test('workspace context actions navigate between every main page', async () => {
  for (const [view, path] of Object.entries(viewPaths).filter(([view]) => view !== 'board')) {
    await openMenu();
    await workspaceMenu().waitFor();
    await page.getByRole('menuitem', { name: 'Go to…', exact: true }).press('ArrowRight');
    await page
      .getByRole('menuitem', { name: viewTitles[view as keyof typeof viewTitles], exact: true })
      .click();
    if (path === '/chat')
      await expect.poll(() => new URL(page.url()).pathname).toMatch(/^\/chat\//);
    else await expect.poll(() => new URL(page.url()).pathname).toBe(path);
    await page.locator('#main > .page').waitFor();
  }
  await page.getByRole('heading', { name: 'Settings', exact: true }).waitFor();
  await openMenu();
  await expect.poll(() => workspaceMenu().isVisible()).toBe(true);
  await page.screenshot({ path: '/tmp/pitchcrew-workspace-context-menu.png' });
  await page.keyboard.press('Escape');
  expect(errors).toEqual([]);
}, 60000);

test('workspace actions open existing search and creation dialogs with focus', async () => {
  for (const name of ['Search workspace…', 'Add job…', 'New conversation…']) {
    await openMenu();
    await page.getByRole('menuitem', { name, exact: true }).click();
    const dialog = page.getByRole('dialog');
    await dialog.waitFor();
    await expect
      .poll(() => dialog.evaluate((element) => element.contains(document.activeElement)))
      .toBe(true);
    await page.keyboard.press('Escape');
    await dialog.waitFor({ state: 'hidden' });
  }
});

test('copies the selected text and clicked link without navigating', async () => {
  const heading = page.getByRole('heading', { name: 'Board', exact: true });
  await heading.evaluate((element) => {
    const range = document.createRange();
    range.selectNodeContents(element);
    window.getSelection()?.removeAllRanges();
    window.getSelection()?.addRange(range);
  });
  await heading.click({ button: 'right' });
  await page.getByRole('menuitem', { name: 'Copy selected text', exact: true }).click();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe('Board');
  const link = page.getByRole('link', { name: 'Queue', exact: true }).first();
  const href = await link.evaluate((element) => (element as HTMLAnchorElement).href);
  await link.click({ button: 'right' });
  await page.getByRole('menuitem', { name: 'Copy link', exact: true }).click();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(href);
  expect(new URL(page.url()).pathname).toBe('/');
});

test('editing controls retain their context behavior and refresh preserves the local draft', async () => {
  const input = page.getByRole('textbox', { name: 'Search jobs', exact: true });
  await input.fill('local draft');
  expect(
    await input.evaluate((element) => {
      const event = new MouseEvent('contextmenu', { bubbles: true, cancelable: true });
      element.dispatchEvent(event);
      return event.defaultPrevented;
    }),
  ).toBe(false);
  expect(await workspaceMenu().count()).toBe(0);
  await openMenu();
  await page.getByRole('menuitem', { name: 'Refresh workspace', exact: true }).click();
  expect(await input.inputValue()).toBe('local draft');
  await input.fill('');
});
