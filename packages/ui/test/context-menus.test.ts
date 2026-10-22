import { chromium, type Browser, type Page } from 'playwright';
import { afterAll, beforeAll, beforeEach, expect, test } from 'vitest';
import { setup, cleanup } from './helpers/daemon.ts';
import { viewTitles } from '../src/AppSidebar/constants.ts';
import { viewPaths } from '../src/navigation.ts';

let host: Awaited<ReturnType<typeof setup>>;
let browser: Browser;
let page: Page;
const errors: string[] = [];
const workspaceMenu = () => page.getByRole('menu', { name: 'Workspace actions', exact: true });
const openMenu = () =>
  page.locator('#main > .page').click({ button: 'right', position: { x: 10, y: 10 } });

beforeAll(async () => {
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

test('highlighted input text opens the copy menu and restores the field without changing its value', async () => {
  const input = page.getByRole('textbox', { name: 'Search jobs', exact: true });
  await input.fill('Fictional Menu');
  await input.evaluate((element: HTMLInputElement) => element.setSelectionRange(0, 9));
  await input.click({ button: 'right', position: { x: 20, y: 15 } });
  const menu = page.getByRole('menu', { name: 'Text actions', exact: true });
  await menu.waitFor();
  expect(await menu.getByRole('menuitem').count()).toBe(1);
  await menu.getByRole('menuitem', { name: 'Copy selected text', exact: true }).click();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe('Fictional');
  await expect
    .poll(() => input.evaluate((element) => element === document.activeElement))
    .toBe(true);
  expect(await input.inputValue()).toBe('Fictional Menu');
});

test('highlighted text takes priority over job actions and ordinary right-click still opens the job menu', async () => {
  const title = page.locator('.job-card h3').first();
  await title.evaluate((element) => {
    const range = document.createRange();
    range.selectNodeContents(element);
    window.getSelection()?.removeAllRanges();
    window.getSelection()?.addRange(range);
  });
  await title.click({ button: 'right' });
  const menu = page.getByRole('menu', { name: 'Text actions', exact: true });
  await menu.getByRole('menuitem', { name: 'Copy selected text', exact: true }).click();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe('Engineer');
  await menu.waitFor({ state: 'detached' });
  await page.evaluate(() => window.getSelection()?.removeAllRanges());
  await title.click({ button: 'right' });
  await page.getByRole('menu', { name: 'Job actions', exact: true }).waitFor();
  await page.keyboard.press('Escape');
});

test('highlighted textarea and document text can be copied inside a dialog while preserving its draft', async () => {
  await page.getByRole('button', { name: 'Add job', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Add a job post', exact: true });
  const input = dialog.getByRole('textbox', { name: 'Job description', exact: true });
  await input.fill('Selected description\nKeep this draft');
  await input.evaluate((element: HTMLTextAreaElement) => element.setSelectionRange(0, 20));
  await input.click({ button: 'right', position: { x: 20, y: 15 } });
  const menu = page.getByRole('menu', { name: 'Text actions', exact: true });
  await menu.getByRole('menuitem', { name: 'Copy selected text', exact: true }).click();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe('Selected description');
  await expect
    .poll(() => input.evaluate((element) => element === document.activeElement))
    .toBe(true);
  expect(await input.inputValue()).toBe('Selected description\nKeep this draft');
  const intro = dialog.locator('.modal-intro');
  const text = await intro.innerText();
  await intro.evaluate((element) => {
    const range = document.createRange();
    range.selectNodeContents(element);
    window.getSelection()?.removeAllRanges();
    window.getSelection()?.addRange(range);
  });
  await intro.click({ button: 'right' });
  await menu.getByRole('menuitem', { name: 'Copy selected text', exact: true }).click();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(text);
  expect(await dialog.isVisible()).toBe(true);
  await input.fill('');
  await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
  await dialog.waitFor({ state: 'detached' });
});

test('highlighted chat drafts can be copied without sending or clearing the message', async () => {
  await page.getByRole('link', { name: 'Chat', exact: true }).click();
  const editor = page.locator('.chat-rich-input');
  await editor.fill('Selected chat draft');
  await editor.evaluate((element) => {
    const range = document.createRange();
    range.selectNodeContents(element);
    window.getSelection()?.removeAllRanges();
    window.getSelection()?.addRange(range);
  });
  await editor.click({ button: 'right', position: { x: 20, y: 15 } });
  await page
    .getByRole('menu', { name: 'Text actions', exact: true })
    .getByRole('menuitem', { name: 'Copy selected text', exact: true })
    .click();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe('Selected chat draft');
  expect(await editor.innerText()).toBe('Selected chat draft');
  await expect
    .poll(() => editor.evaluate((element) => element === document.activeElement))
    .toBe(true);
  await editor.fill('');
  expect(errors).toEqual([]);
});
