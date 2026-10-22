import { chromium, type Browser, type Page } from 'playwright';
import { afterAll, beforeAll, expect, test } from 'vitest';
import type { Card } from '@pitchcrew/core';
import { cleanup, setup } from './helpers/daemon.ts';

let host: Awaited<ReturnType<typeof setup>>;
let browser: Browser;
let page: Page;
const errors: string[] = [];
const starters = [
  'Research a company',
  'Improve my LinkedIn',
  'Prepare for an interview',
  'Practice with me',
  'Debrief an interview',
  'Plan my career',
  'Evaluate an offer',
];

beforeAll(async () => {
  host = await setup(19749);
  host.daemon.service.onboarding.save({ version: 1, status: 'dismissed', step: 0 });
  browser = await chromium.launch({ headless: true });
  page = await browser.newPage({ viewport: { width: 1280, height: 900 }, reducedMotion: 'reduce' });
  page.setDefaultTimeout(10000);
  page.on('pageerror', (error) => errors.push(error.message));
}, 60000);
afterAll(async () => {
  await browser?.close();
  await cleanup();
});

test('offers all coaching activities with or without an attached job, fills the existing composer and fits mobile', async () => {
  await page.goto(`${host.daemon.url}/chat/career-coach`);
  await page
    .getByRole('heading', { name: 'Prepare for your next career step', exact: true })
    .waitFor({ timeout: 30000 });
  for (const label of starters)
    expect(await page.getByRole('button', { name: label, exact: true }).isVisible()).toBe(true);
  await page.getByRole('button', { name: 'Improve my LinkedIn', exact: true }).click();
  expect(await page.locator('.chat-rich-input').textContent()).toContain('measured length checks');
  await page.getByRole('button', { name: 'Research a company', exact: true }).click();
  expect(await page.locator('.chat-rich-input').textContent()).toContain('sourced brief');
  await page.getByRole('button', { name: 'Practice with me', exact: true }).click();
  expect(await page.locator('.chat-rich-input').textContent()).toContain('one question at a time');
  expect(host.daemon.service.board.list('run')).toEqual([]);
  const card = (
    await host.request<Card>('/cards', 'POST', {
      company: 'Example Works',
      title: 'Analyst',
      description: 'Fictional job for practice.',
    })
  ).result;
  expect(
    (await host.request('/conversations/career-coach', 'PUT', { cardId: card.id })).response.status,
  ).toBe(200);
  await page.reload();
  await page.getByRole('button', { name: 'Evaluate an offer', exact: true }).waitFor();
  await page.setViewportSize({ width: 390, height: 844 });
  for (const label of starters)
    expect(await page.getByRole('button', { name: label, exact: true }).isVisible()).toBe(true);
  await page.getByRole('button', { name: 'Evaluate an offer', exact: true }).click();
  expect(await page.locator('.chat-rich-input').textContent()).toContain(
    'compensation and contract terms',
  );
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(errors).toEqual([]);
}, 60000);

test('offers Scout research with and without job context and keeps existing starters', async () => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto(`${host.daemon.url}/chat/scout`);
  for (const attached of [false, true]) {
    if (attached) {
      const card = host.daemon.service.board.list<Card>('card')[0];
      expect(
        (await host.request('/conversations/scout', 'PUT', { cardId: card.id })).response.status,
      ).toBe(200);
      await page.reload();
      await page.getByRole('button', { name: 'Evaluate this job', exact: true }).waitFor();
    }
    await page.getByRole('button', { name: 'Research a company', exact: true }).click();
    expect(await page.locator('.chat-rich-input').textContent()).toContain('sourced brief');
    expect(
      await page.getByRole('button', { name: 'What should I look for?', exact: true }).isVisible(),
    ).toBe(true);
    expect(
      await page.getByRole('button', { name: 'Improve my LinkedIn', exact: true }).count(),
    ).toBe(0);
  }
  expect(host.daemon.service.board.list('run')).toEqual([]);
  expect(errors).toEqual([]);
});

test('completes agent and skill references in the real workspace and persists matching transcript chips', async () => {
  const skill = await host.request<import('@pitchcrew/core').Skill>('/skills', 'POST', {
    name: 'Fixture evidence check',
    description: 'Check exact profile quotations.',
    content: 'Use exact profile quotations.',
    scope: 'all',
  });
  expect(skill.response.status).toBe(201);
  const conversation = await host.request<import('@pitchcrew/core').Conversation>(
    '/conversations',
    'POST',
    { title: 'Reference integration fixture', participants: ['scout', 'writer'] },
  );
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto(`${host.daemon.url}/chat/${conversation.result.id}`);
  const editor = page.getByRole('textbox', { name: 'Message the group', exact: true });
  await editor.pressSequentially('@sco');
  await page.keyboard.press('Enter');
  await editor.pressSequentially('Use $fixture');
  await page.keyboard.press('Tab');
  await expect.poll(() => editor.locator('[data-reference-key]').count()).toBe(2);
  await page.screenshot({ path: '/tmp/pitchcrew-inline-chat-draft.png' });
  await page.keyboard.press('Enter');
  // Sending reloads the compact snapshot and paged history before the transcript renders.
  // Allow the same browser readiness budget as other UI waits on a busy CI runner.
  await expect
    .poll(() => page.locator('.chat-message.is-user .chat-reference').count(), { timeout: 10000 })
    .toBe(2);
  const snapshot = await host.request<import('@pitchcrew/core').Snapshot>('/snapshot');
  const message = snapshot.result.messages.find(
    (message) => message.threadId === conversation.result.id && message.from === 'user',
  );
  expect(message?.references?.map((reference) => reference.kind)).toEqual(['agent', 'skill']);
  expect(message?.references?.[1].id).toBe(skill.result.id);
  await page.screenshot({ path: '/tmp/pitchcrew-inline-chat-desktop.png' });
  await page.setViewportSize({ width: 390, height: 844 });
  await editor.pressSequentially('$fixture');
  await page.getByRole('listbox', { name: 'Message suggestions' }).waitFor();
  await page.screenshot({ path: '/tmp/pitchcrew-inline-chat-mobile.png' });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(errors).toEqual([]);
});
