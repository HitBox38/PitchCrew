import { chromium, type Browser, type Page } from 'playwright';
import { afterAll, beforeAll, beforeEach, expect, test } from 'vitest';
import { observeSettingsSaves } from '../saved-stamps.ts';

let browser: Browser;
let page: Page;
beforeAll(async () => {
  browser = await chromium.launch({ headless: true });
  page = await browser.newPage();
});
afterAll(async () => browser?.close());
beforeEach(async () => {
  await page.evaluate('window.stopObserving?.(); window.storageFailed = false');
  await page.setContent(`<main id="root">
    <button id="tab">Another section</button>
    <label class="settings-row" id="row-a" for="a"><span id="label">Sound</span>
      <button id="a" role="switch" aria-checked="false">Toggle</button></label>
    <div class="settings-row" id="row-b"><button id="b" role="switch" aria-checked="false">Other</button></div>
    <section id="themes" data-autosave><div role="radiogroup">
      <button id="light" role="radio" aria-checked="true">Light</button>
      <button id="dark" role="radio" aria-checked="false">Dark</button>
    </div></section><output id="status"></output></main>`);
  await page.evaluate(`window.stopObserving = (${observeSettingsSaves.toString()})(
    document.getElementById('root'), () => !window.storageFailed,
    message => document.getElementById('status').textContent = message
  )`);
});

const checked = (id: string, value: boolean) =>
  page.locator(`#${id}`).evaluate((element, next) => {
    element.setAttribute('aria-checked', String(next));
  }, value);
const saved = (id: string) => page.locator(`#${id}`).getAttribute('data-saved');

test('ignores panel mounting and unrelated controls after navigation or another preference interaction', async () => {
  await page.locator('#tab').click();
  await checked('b', true);
  expect(await saved('row-b')).toBeNull();
  await page.locator('#a').click();
  await checked('b', false);
  expect(await saved('row-b')).toBeNull();
  await checked('a', true);
  expect(await saved('row-a')).toBe('');
  expect(await page.locator('#status').textContent()).toBe('Saved');
});

test('labels and keyboard radio changes confirm only the selected committed value', async () => {
  await page.locator('#label').click();
  await checked('a', true);
  expect(await saved('row-a')).toBe('');
  await page.locator('#light').dispatchEvent('keydown', { key: 'ArrowRight' });
  await checked('light', false);
  expect(await saved('themes')).toBeNull();
  await checked('dark', true);
  expect(await saved('themes')).toBe('');
  await checked('dark', false);
  expect(await saved('row-b')).toBeNull();
});

test('failed device persistence reports session-only state and never stamps Saved', async () => {
  await page.evaluate('window.storageFailed = true');
  await page.locator('#a').click();
  await checked('a', true);
  expect(await saved('row-a')).toBeNull();
  expect(await page.locator('#status').textContent()).toContain('Applied for this session');
});

test('disconnecting clears pending confirmations and stops observing later updates', async () => {
  await page.locator('#a').click();
  await checked('a', true);
  expect(await saved('row-a')).toBe('');
  await page.evaluate('window.stopObserving()');
  expect(await saved('row-a')).toBeNull();
  await page.locator('#b').click();
  await checked('b', true);
  expect(await saved('row-b')).toBeNull();
});

test('a failed second save clears the old stamp and survives other confirmation timers', async () => {
  await page.clock.install();
  await page.locator('#a').click();
  await checked('a', true);
  await page.locator('#b').click();
  await checked('b', true);
  expect(await saved('row-a')).toBe('');
  await page.evaluate('window.storageFailed = true');
  await page.locator('#a').click();
  await checked('a', false);
  expect(await saved('row-a')).toBeNull();
  await page.clock.fastForward(2500);
  expect(await page.locator('#status').textContent()).toContain('Applied for this session');
});

test('a later successful control announces its own save without repeating an earlier failure', async () => {
  await page.evaluate('window.storageFailed = true');
  await page.locator('#a').click();
  await checked('a', true);
  expect(await page.locator('#status').textContent()).toContain('Applied for this session');
  await page.evaluate('window.storageFailed = false');
  await page.locator('#b').click();
  await checked('b', true);
  expect(await saved('row-a')).toBeNull();
  expect(await saved('row-b')).toBe('');
  expect(await page.locator('#status').textContent()).toBe('Saved');
});
