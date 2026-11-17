import { chromium, type Browser, type Page } from 'playwright';
import { afterAll, beforeAll, expect, test } from 'vitest';
import { defaultCapabilities, type Conversation, type Role } from '@pitchcrew/core';
import {
  browserModeLabels,
  browserModeLimits,
  browserModeOrder,
  browserModeSummaries,
} from '@pitchcrew/core/browser-modes';
import { resolve } from 'node:path';
import { cleanup, setup } from './helpers/daemon.ts';

/* Choosing browser permissions: the composer's per-conversation picker and an agent's default in
 * its settings offer every mode in order, save the choice and say what the chosen mode allows. */

let host: Awaited<ReturnType<typeof setup>>;
let browser: Browser;
let page: Page;
let thread: string;
const errors: string[] = [];
const labels = browserModeOrder.map((mode) => browserModeLabels[mode]);

beforeAll(async () => {
  host = await setup();
  const service = host.daemon.service;
  service.onboarding.save({ version: 1, status: 'dismissed', step: 0 });
  const role = service.board.get<Role>('role', 'writer');
  service.board.record(
    'role',
    { ...role, capabilities: { ...defaultCapabilities, ...role.capabilities, computerUse: true } },
    'user',
    'Browser permissions fixture',
  );
  thread = service.createConversation({
    title: 'Fictional browser permissions',
    participants: ['writer'],
  }).id;
  browser = await chromium.launch({ headless: true });
  page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  page.setDefaultTimeout(10000);
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(`${host.daemon.url}/chat/${thread}`, { waitUntil: 'domcontentloaded' });
  await chip().waitFor({ timeout: 30000 });
}, 60000);

afterAll(async () => {
  await browser?.close();
  await cleanup();
}, 30000);

/** The composer's mode chip; the reading-width lane keeps the picker in its popover. */
const chip = () => page.locator('.chat-composer-mode');
const optionsPanel = () => page.getByRole('dialog', { name: 'Browser permissions', exact: true });
const picker = () =>
  optionsPanel().getByRole('combobox', { name: 'Writer browser permissions', exact: true });
const override = () =>
  host.daemon.service.board.get<Conversation>('conversation', thread).configurations.writer
    ?.browserMode;
const savedMode = () => host.daemon.service.board.get<Role>('role', 'writer').browserMode;
const options = async () => {
  await page.getByRole('listbox').waitFor();
  return (await page.getByRole('option').allTextContents()).map((text) => text.trim());
};
const choose = async (name: string) => {
  await page.getByRole('option', { name, exact: true }).click();
  await page.getByRole('listbox').waitFor({ state: 'hidden' });
};
/** Opens the chip's options (unless still open) and then the picker inside them. */
const openPicker = async () => {
  if (!(await optionsPanel().isVisible())) await chip().click();
  await picker().click();
};
/** Review screenshots, only when PITCHCREW_BROWSER_PERMISSIONS_EVIDENCE names a folder. */
const capture = async (name: string) => {
  const output = process.env.PITCHCREW_BROWSER_PERMISSIONS_EVIDENCE;
  if (!output) return;
  // Popovers open with a transition; shoot them settled.
  await page.evaluate(() => Promise.all(document.getAnimations().map((item) => item.finished)));
  await page.screenshot({ path: resolve(output, `${name}.png`) });
};

test('the composer picker offers every mode, saves the choice and names it on its chip', async () => {
  expect(await chip().textContent()).toBe('Supervised');
  expect(await chip().getAttribute('data-mode')).toBe('supervised');
  expect(await chip().getAttribute('data-acts-alone')).toBeNull();
  await chip().click();
  await optionsPanel().waitFor();
  expect(await optionsPanel().textContent()).toContain(
    'Applies to the next turn. Every mode asks before the final submission and anything Pitchcrew recognizes as sending (best effort).',
  );
  await openPicker();
  expect(await options()).toEqual(['Agent default (Supervised)', ...labels]);
  await choose('Full access');
  await expect.poll(override).toBe('full');
  await expect.poll(() => chip().textContent()).toBe('Full access');
  expect(await chip().getAttribute('data-mode')).toBe('full');
  expect(await chip().getAttribute('data-acts-alone')).not.toBeNull();
  await capture('composer-full-access');

  // The short chip label and the shared full label for Autonomous preparation.
  await openPicker();
  await choose('Autonomous preparation');
  await expect.poll(override).toBe('autonomous');
  await expect.poll(() => chip().textContent()).toBe('Autonomous');
  expect(await chip().getAttribute('title')).toBe('Browser permissions: Autonomous preparation');

  // Agent default removes the override and follows the saved mode again.
  await openPicker();
  await choose('Agent default (Supervised)');
  await expect.poll(override).toBeUndefined();
  await expect.poll(() => chip().textContent()).toBe('Supervised');
  expect(await chip().getAttribute('data-acts-alone')).toBeNull();

  // The longest chip label still fits a phone's composer row.
  await openPicker();
  await choose('Accept edits');
  await expect.poll(() => chip().textContent()).toBe('Accept edits');
  await page.keyboard.press('Escape');
  await optionsPanel().waitFor({ state: 'hidden' });
  for (const width of [390, 320]) {
    await page.setViewportSize({ width, height: 844 });
    await chip().waitFor();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    const box = (await chip().boundingBox())!;
    expect(box.x + box.width).toBeLessThanOrEqual(width);
    await capture(`composer-phone-${width}`);
  }
  await page.setViewportSize({ width: 1440, height: 1000 });

  // The help lists every mode in the shared words and what holds in all of them.
  if (!(await optionsPanel().isVisible())) await chip().click();
  await optionsPanel()
    .getByRole('button', { name: 'Writer browser permission details', exact: true })
    .click();
  const help = page.getByRole('dialog', {
    name: 'Writer’s next turn in this conversation',
    exact: true,
  });
  await help.waitFor();
  const text = await help.textContent();
  for (const mode of browserModeOrder)
    expect(text).toContain(`${browserModeLabels[mode]}: ${browserModeSummaries[mode]}`);
  expect(text).toContain(browserModeLimits);
  expect(text).toContain('Changes apply to future turns.');
  await capture('mode-help');
  await page.keyboard.press('Escape');
  await help.waitFor({ state: 'hidden' });
  await page.keyboard.press('Escape');
  await optionsPanel().waitFor({ state: 'hidden' });
  expect(errors).toEqual([]);
}, 30000);

test('agent settings choose the default mode and say what it allows', async () => {
  // The conversation follows the agent's default, so its chip shows the newly saved mode.
  await host.daemon.service.updateConversation(thread, { configurations: { writer: {} } });
  expect(override()).toBeUndefined();
  await page.goto(`${host.daemon.url}/crew`, { waitUntil: 'domcontentloaded' });
  const card = page
    .locator('.crew-card')
    .filter({ has: page.getByRole('heading', { name: 'Writer', exact: true }) });
  const capability = card.locator('.crew-card-capability');
  await expect.poll(() => capability.textContent()).toBe('Browser, asks first');
  await card.getByRole('button', { name: 'Writer', exact: true }).click();
  const select = page.getByRole('combobox', { name: 'Default browser permissions', exact: true });
  const summary = page.locator('#agent-browser-summary');
  await select.waitFor();
  expect(await select.getAttribute('aria-describedby')).toBe('agent-browser-summary');
  expect(await summary.textContent()).toBe(browserModeSummaries.supervised);
  await page
    .getByText('Each conversation can override this. Scheduled routines stay supervised.', {
      exact: true,
    })
    .waitFor();
  await select.click();
  expect(await options()).toEqual(labels);
  await choose('Auto');
  expect(await summary.textContent()).toBe(browserModeSummaries.auto);
  await capture('agent-settings-auto');
  // The settings no longer promise that every browser action asks.
  expect(
    await page
      .getByText('browser actions follow this agent’s browser permissions', { exact: false })
      .count(),
  ).toBe(1);
  await page.getByRole('button', { name: 'Save settings', exact: true }).click();
  await expect.poll(savedMode).toBe('auto');
  await select.waitFor({ state: 'hidden' });
  await expect.poll(() => capability.textContent()).toBe('Browser, asks before risky steps');

  // The composer's Agent default names the newly saved mode.
  await page.goto(`${host.daemon.url}/chat/${thread}`, { waitUntil: 'domcontentloaded' });
  await expect.poll(() => chip().textContent()).toBe('Auto');
  expect(await chip().getAttribute('data-acts-alone')).not.toBeNull();
  await openPicker();
  expect((await options())[0]).toBe('Agent default (Auto)');
  await page.keyboard.press('Escape');
  await page.getByRole('listbox').waitFor({ state: 'hidden' });
  await page.keyboard.press('Escape');
  await optionsPanel().waitFor({ state: 'hidden' });
  expect(errors).toEqual([]);
}, 30000);
