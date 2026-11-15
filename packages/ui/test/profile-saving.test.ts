import { chromium, type Browser, type Page, type Route } from 'playwright';
import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { afterAll, afterEach, beforeAll, expect, test } from 'vitest';
import { cleanup, setup } from './helpers/daemon.ts';
import { editorValue } from './helpers/markdown-editor.ts';

/**
 * Autosave runs alongside typing, closing, renaming and deleting. These hold a save open and race
 * the other actions against it, as a slow disk or a busy daemon would.
 */
let browser: Browser;
const errors: string[] = [];

beforeAll(async () => {
  browser = await chromium.launch({ headless: true });
}, 60000);
afterAll(async () => {
  await browser?.close();
});
afterEach(async () => {
  await cleanup();
  expect(errors.splice(0)).toEqual([]);
});

const open = async (notes: Record<string, string>) => {
  const host = await setup();
  for (const [name, content] of Object.entries(notes))
    await host.daemon.service.saveProfile(name, content);
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  page.setDefaultTimeout(10000);
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(`${host.daemon.url}/profile`, { waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: 'Set up later', exact: true }).click();
  return { host, page, file: (name: string) => join(host.directory, 'profile', name) };
};

/** Holds every note save until released, and counts them. */
const holdSaves = async (page: Page) => {
  const held: Route[] = [];
  let holding = true;
  await page.route('**/api/profile', (route) =>
    holding && route.request().method() === 'PUT' ? held.push(route) : route.continue(),
  );
  return {
    held,
    release: async () => {
      holding = false;
      for (const route of held.splice(0)) await route.continue();
    },
  };
};

const editor = (page: Page) => page.getByRole('textbox', { name: 'Profile Markdown', exact: true });

test('closing a tab keeps text typed while its save was in flight', async () => {
  const { page, file } = await open({ 'notes.md': '# Notes' });
  const saves = await holdSaves(page);
  await editor(page).click();
  await page.keyboard.press('Meta+End');
  await page.keyboard.type('\nFirst line.');
  await expect.poll(() => saves.held.length).toBe(1);
  await page.keyboard.type('\nTyped during the save.');
  await page.getByRole('button', { name: 'Close notes', exact: true }).click();
  await saves.release();
  await expect.poll(() => page.locator('.profile-tab-item').count()).toBe(0);
  expect(await readFile(file('notes.md'), 'utf8')).toBe(
    '# Notes\nFirst line.\nTyped during the save.',
  );
});

test('deleting a new note during its first save does not bring it back', async () => {
  const { page, host } = await open({ 'profile.md': '# Me' });
  await page.getByRole('button', { name: 'New note', exact: true }).first().click();
  const create = page.getByRole('dialog', { name: 'New note' });
  await create.getByRole('textbox', { name: 'Name' }).fill('Short lived');
  const saves = await holdSaves(page);
  await create.getByRole('button', { name: 'Create note', exact: true }).click();
  await expect.poll(() => saves.held.length).toBe(1);
  await page.locator('.profile-tab-item', { hasText: 'Short lived' }).click({ button: 'right' });
  await page.getByRole('menuitem', { name: 'Delete…' }).click();
  await page.getByRole('button', { name: 'Delete note', exact: true }).click();
  await saves.release();
  await page.getByRole('button', { name: 'Undo' }).waitFor();
  await page.waitForTimeout(1500);
  expect(await readdir(join(host.directory, 'profile'))).toEqual(['profile.md']);
  expect(await page.getByRole('treeitem', { name: 'Short lived' }).count()).toBe(0);
});

test('turning autosave on saves every dirty tab, one after another', async () => {
  const { page, file } = await open({ 'a.md': '# A', 'b.md': '# B' });
  await page.getByRole('button', { name: 'Editor options' }).click();
  await page.getByRole('menuitemcheckbox', { name: 'Save automatically' }).click();
  await page.keyboard.press('Escape');
  for (const [label, text] of [
    ['a', ' edited A'],
    ['b', ' edited B'],
  ]) {
    await page.getByRole('treeitem', { name: label, exact: true }).click();
    await editor(page).click();
    await page.keyboard.press('Meta+End');
    await page.keyboard.type(text);
  }
  expect(await editorValue(editor(page))).toBe('# B edited B');
  await page.getByRole('button', { name: 'Editor options' }).click();
  await page.getByRole('menuitemcheckbox', { name: 'Save automatically' }).click();
  await page.keyboard.press('Escape');
  await expect.poll(() => readFile(file('a.md'), 'utf8')).toBe('# A edited A');
  await expect.poll(() => readFile(file('b.md'), 'utf8')).toBe('# B edited B');
  await expect.poll(() => page.locator('.profile-save-state').innerText()).toContain('Saved');
});
