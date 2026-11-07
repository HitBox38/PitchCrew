import { randomUUID } from 'node:crypto';
import { join } from 'node:path';
import { chromium, type Browser, type Page } from 'playwright';
import { adapters } from '../../adapters/src/index.ts';
import { createBrowserDriver } from '../../mcp/src/computer.ts';
import {
  defaultCapabilities,
  type ChatContext,
  type Role,
  type UserInputRequest,
} from '@pitchcrew/core';
import { afterAll, beforeAll, expect, test, vi } from 'vitest';
import { setup, cleanup } from './helpers/daemon.ts';

let browser: Browser;
let computerBrowser: Browser;
let page: Page;
let host: Awaited<ReturnType<typeof setup>>;
let question: UserInputRequest;

beforeAll(async () => {
  computerBrowser = await chromium.launch({ headless: true });
  const driver = await createBrowserDriver(computerBrowser);
  await computerBrowser
    .contexts()[0]
    .pages()[0]
    .setContent('<title>Fictional application</title><p>Application form fixture</p>');
  host = await setup(23971, false, { browserLaunch: async () => driver });
  const service = host.daemon.service;
  const role = service.board.get<Role>('role', 'writer');
  service.board.record(
    'role',
    {
      ...role,
      name: 'Submitter',
      capabilities: { ...defaultCapabilities, ...role.capabilities, computerUse: true },
    },
    'user',
    'Question layout fixture',
  );
  const card = service.createCard({
    company: 'Fictional Games',
    title: 'Senior Frontend Engineer',
  });
  const thread = service.createConversation({
    title: 'Application preparation',
    participants: ['writer'],
    cardId: card.id,
  });
  await service.computer.openBrowser('writer', thread.id, card.id);
  for (let i = 0; i < 3; i++) {
    const related = service.createConversation({
      title: `Related application work ${i}`,
      participants: ['writer'],
      cardId: card.id,
    });
    service.board.record(
      'conversation',
      { ...related, parentId: thread.id },
      'user',
      'Related fixture',
    );
  }
  for (let i = 0; i < 70; i++) {
    service.board.record(
      'message',
      {
        id: randomUUID(),
        threadId: thread.id,
        from: 'user',
        to: 'writer',
        cardId: card.id,
        runId: null,
        content: `Earlier application message ${i}. Keep this available while answering.`,
        createdAt: new Date(Date.now() - (70 - i) * 60000).toISOString(),
      },
      'user',
      'History fixture',
    );
  }
  let context: ChatContext | undefined;
  vi.spyOn(adapters.demo, 'chat').mockImplementation(async (turn) => {
    if (context) return { reply: 'Answer received.' };
    context = turn;
    await new Promise((_, reject) =>
      turn.signal.addEventListener('abort', () => reject(new Error('Stopped')), { once: true }),
    );
    return { reply: '' };
  });
  await host.request(`/conversations/${thread.id}/messages`, 'POST', {
    content: 'Check the application requirements.',
  });
  await vi.waitFor(() => expect(context).toBeDefined());
  browser = await chromium.launch({ headless: true });
  page = await browser.newPage({ viewport: { width: 1442, height: 962 } });
  await page.goto(`${host.daemon.url}/chat/${thread.id}`, { waitUntil: 'domcontentloaded' });
  await page.locator('.chat-heading').waitFor({ timeout: 30000 });
  const later = page.getByRole('button', { name: 'Set up later', exact: true });
  if (await later.isVisible()) await later.click();
  await page.evaluate(() => {
    const observer = new MutationObserver(() => {
      const lane = document.querySelector('.pending-user-questions-lane');
      if (lane && new DOMMatrixReadOnly(getComputedStyle(lane).transform).m42 > 1) {
        document.documentElement.dataset.questionEntered = 'true';
        observer.disconnect();
      }
    });
    observer.observe(document.body, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ['style'],
    });
  });
  const result = await service.agentCall(context!.mcp.env.PITCHCREW_RUN_TOKEN!, 'ask_user', {
    question: 'Please review these application requirements before I continue. '.repeat(28),
    reason: 'The application asks for specific details which need your confirmation. '.repeat(24),
    options: Array.from({ length: 12 }, (_, i) => ({
      id: `choice-${i}`,
      label: `Confirm requirement ${i}`,
      description: 'A detailed requirement from the fictional application form. '.repeat(4),
    })),
    multiSelect: true,
  });
  question = result.question as UserInputRequest;
  await page.locator('.pending-user-question').waitFor({ timeout: 30000 });
}, 60000);

afterAll(async () => {
  await browser?.close();
  await cleanup();
  await computerBrowser?.close();
});

test('keeps history and the answer footer reachable beside an expanded long question', async () => {
  const toggleBrowser = page.locator('button[aria-controls="agent-browser-panel"]');
  const answer = page.locator('.pending-user-question textarea');
  await answer.fill('Keep my answer draft.');
  await expect.poll(() => page.locator('html').getAttribute('data-question-entered')).toBe('true');
  // Keep the entrance visibly in flight even when draft entry has already waited for stability.
  await page.locator('.pending-user-questions-lane').evaluate(async (lane) => {
    const animation = lane.animate(
      [{ transform: 'translateY(40px)' }, { transform: 'translateY(0px)' }],
      {
        duration: 1200,
      },
    );
    await animation.finished;
    animation.cancel();
  });
  // The entrance deliberately passes behind the composer. Measure its resting layout only
  // after the lane reaches its final position, without weakening any of the bounds below.
  await expect
    .poll(
      () =>
        page
          .locator('.pending-user-questions-lane')
          .evaluate((lane) => new DOMMatrixReadOnly(getComputedStyle(lane).transform).m42),
      { timeout: 5000 },
    )
    .toBe(0);
  for (const size of [
    { width: 1442, height: 962 },
    { width: 1366, height: 768 },
    { width: 1200, height: 800 },
    { width: 1100, height: 768 },
    { width: 820, height: 720 },
    { width: 390, height: 844 },
  ]) {
    await page.setViewportSize(size);
    for (const open of [false, true]) {
      if ((await toggleBrowser.getAttribute('aria-expanded')) !== String(open))
        await toggleBrowser.click();
      if (open && size.width < 1101) {
        await page.getByRole('dialog', { name: /browser/i }).waitFor();
        await page.getByRole('button', { name: 'Hide browser', exact: true }).click();
        expect(await answer.inputValue()).toBe('Keep my answer draft.');
        continue;
      }
      const submit = page.locator('.pending-user-question button[type="submit"]');
      // Short columns may scroll as a whole; reveal the actions through that scroll owner.
      await submit.scrollIntoViewIfNeeded();
      const measure = () =>
        page.evaluate(() => {
          const measure = (selector: string) => {
            const element = document.querySelector(selector)!;
            const rect = element.getBoundingClientRect();
            return {
              top: rect.top,
              height: rect.height,
              bottom: rect.bottom,
              scroll: element.scrollHeight,
              scrollTop: element.scrollTop,
              overflow: getComputedStyle(element).overflowY,
              hidden: element instanceof HTMLElement && element.hidden,
              transform: getComputedStyle(element).transform,
            };
          };
          return {
            panel: measure('.chat-panel'),
            history: measure('[data-slot="message-scroller-viewport"]'),
            dock: measure('.pending-user-questions'),
            stage: measure('.pending-question-stage'),
            fields: measure('.user-question-fields'),
            lane: measure('.pending-user-questions-lane'),
            composer: measure('.chat-compose'),
            answer: measure('.user-question-custom'),
            actions: measure('.user-question-actions'),
            content: measure('.pending-user-question [data-slot="collapsible-content"]'),
            form: measure('.user-question-form'),
          };
        });
      await expect
        .poll(async () => {
          const current = await measure();
          // Four 20px body lines remain readable beside the long question and the pager.
          expect(
            current.history.height,
            JSON.stringify({ size, open, layout: current }),
          ).toBeGreaterThanOrEqual(80);
          return true;
        })
        .toBe(true);
      const layout = await measure();
      expect(layout.fields.height, JSON.stringify({ size, open, layout })).toBeGreaterThan(20);
      expect(layout.fields.scroll).toBeGreaterThan(layout.fields.height);
      expect(layout.answer.top).toBeGreaterThanOrEqual(layout.fields.bottom);
      expect(layout.actions.top).toBeGreaterThanOrEqual(layout.answer.bottom);
      // Native scrollTop is integral while layout rectangles may end on a fractional CSS pixel.
      expect(layout.actions.bottom, JSON.stringify({ size, open, layout })).toBeLessThanOrEqual(
        (layout.composer.hidden ? layout.panel.bottom : layout.composer.top) + 1,
      );
      if (layout.composer.hidden) expect(layout.composer.height).toBe(0);
      expect(layout.stage.scrollTop, JSON.stringify({ size, open, layout })).toBe(0);
      // The transformed Motion wrapper's scrollHeight includes non-visible overflow. Check the
      // actual visible surface and its content against the clip, not that synthetic scroll area.
      expect(layout.lane.top).toBeGreaterThanOrEqual(layout.stage.top);
      expect(layout.lane.bottom).toBeLessThanOrEqual(layout.stage.bottom + 1);
      for (const part of [layout.content, layout.form, layout.answer, layout.actions]) {
        expect(part.top, JSON.stringify({ size, open, layout })).toBeGreaterThanOrEqual(
          layout.lane.top,
        );
        expect(part.bottom, JSON.stringify({ size, open, layout })).toBeLessThanOrEqual(
          layout.lane.bottom + 1,
        );
      }
      if (!layout.composer.hidden && size.height >= 900)
        expect(layout.composer.bottom, JSON.stringify({ size, open, layout })).toBeLessThanOrEqual(
          size.height,
        );
      const submitBounds = (await submit.boundingBox())!;
      expect(submitBounds.y).toBeGreaterThanOrEqual(layout.panel.top);
      expect(submitBounds.y + submitBounds.height).toBeLessThanOrEqual(
        Math.min(size.height, layout.panel.bottom) + 1,
      );
      const history = page.locator('[data-slot="message-scroller-viewport"]');
      // Return the scrollable chat column to its reading position before using its inner history.
      await page.locator('.chat-heading').hover();
      await page.mouse.wheel(0, -100000);
      await expect.poll(() => page.locator('.chat-panel').evaluate((el) => el.scrollTop)).toBe(0);
      await history.hover();
      await page.mouse.wheel(0, -100000);
      await expect.poll(() => history.evaluate((el) => el.scrollTop)).toBe(0);
      await page.getByRole('button', { name: 'Older', exact: true }).click();
      await page
        .getByText('Earlier application message 0. Keep this available while answering.', {
          exact: true,
        })
        .waitFor();
      await page.getByRole('button', { name: 'Latest', exact: true }).click();
      await expect
        .poll(() => page.getByRole('button', { name: 'Latest', exact: true }).isDisabled())
        .toBe(true);
      expect(await page.locator('.user-question-record').count()).toBe(0);
      expect(await answer.isVisible()).toBe(true);
      expect(await answer.inputValue()).toBe('Keep my answer draft.');
      if (size.width === 1442 && open && process.env.PITCHCREW_TEST_ARTIFACTS)
        await page.screenshot({
          path: join(process.env.PITCHCREW_TEST_ARTIFACTS, 'question-layout.png'),
        });
      if (open) await page.getByRole('button', { name: 'Hide browser', exact: true }).click();
    }
  }
  await page.locator('.pending-question-trigger').click();
  await expect.poll(() => answer.isVisible()).toBe(false);
  await page.locator('.user-question-record').waitFor();
  const composer = page.locator('.chat-textarea');
  await composer.fill('A separate composer draft.');
  await page.getByRole('button', { name: 'Answer question', exact: true }).click();
  await expect.poll(() => answer.evaluate((el) => document.activeElement === el)).toBe(true);
  expect(await answer.inputValue()).toBe('Keep my answer draft.');
  const fields = page.locator('.user-question-fields');
  await fields.hover();
  await page.mouse.wheel(0, 10000);
  await expect.poll(() => fields.evaluate((el) => el.scrollTop)).toBeGreaterThan(100);
  await fields.getByRole('checkbox', { name: /Confirm requirement 11/ }).click();
  const exitObserved = page.evaluate(
    () =>
      new Promise<boolean>((resolve) => {
        const observer = new MutationObserver(() => {
          if (document.querySelector('.pending-user-questions[inert][aria-hidden="true"]')) {
            observer.disconnect();
            resolve(true);
          }
        });
        observer.observe(document.body, {
          subtree: true,
          attributes: true,
          attributeFilter: ['inert', 'aria-hidden'],
        });
        setTimeout(() => {
          observer.disconnect();
          resolve(false);
        }, 5000);
      }),
  );
  await page
    .locator('.pending-user-question')
    .getByRole('button', { name: 'Answer and continue', exact: true })
    .click();
  await page.locator('.user-question-message[data-status="answered"]').waitFor();
  expect(await exitObserved).toBe(true);
  expect(await composer.textContent()).toBe('A separate composer draft.');
  expect(host.daemon.service.board.get<UserInputRequest>('user_input', question.id).answer).toEqual(
    { selected: ['choice-11'], text: 'Keep my answer draft.' },
  );
  await page.getByText('Answer received.', { exact: true }).waitFor();
}, 60000);
