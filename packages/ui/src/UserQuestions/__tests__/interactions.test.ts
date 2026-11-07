import { afterAll, beforeAll, expect, it } from 'vitest';
import { chromium, type Browser, type Page } from 'playwright';
import { createServer, type ViteDevServer } from 'vite';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { questionInteractionFixture } from './interaction-fixture.ts';
import tailwindcss from '@tailwindcss/vite';
import { randomUUID } from 'node:crypto';
import type { Role, UserInputRequest } from '@pitchcrew/core';
import { setup, cleanup } from '../../../../orchestrator/test/helpers/daemon.ts';

let server: ViteDevServer, browser: Browser, cache: string, url: string;
let rejectionHost: Awaited<ReturnType<typeof setup>> | undefined;
beforeAll(async () => {
  const root = fileURLToPath(new URL('../../..', import.meta.url));
  const designSystem = createRequire(join(root, '../design-system/package.json'));
  const core = createRequire(join(root, '../core/package.json'));
  cache = await mkdtemp(join(tmpdir(), 'pitchcrew-question-ui-'));
  server = await createServer({
    root,
    configFile: false,
    cacheDir: cache,
    resolve: {
      alias: {
        '@': join(root, 'src'),
        ...Object.fromEntries(['strip-ansi', 'zod'].map((name) => [name, core.resolve(name)])),
        ...Object.fromEntries(
          ['class-variance-authority', 'clsx', 'tailwind-merge'].map((name) => [
            name,
            designSystem.resolve(name),
          ]),
        ),
      },
    },
    optimizeDeps: {
      entries: [],
      exclude: ['posthog-js/no-external'],
      include: [
        'react',
        'react-dom/client',
        'lucide-react',
        'lexical',
        '@lexical/react/LexicalComposer',
        '@lexical/react/LexicalHistoryPlugin',
        '@lexical/react/LexicalContentEditable',
        '@lexical/react/LexicalPlainTextPlugin',
        '@lexical/react/LexicalErrorBoundary',
        '@lexical/react/LexicalComposerContext',
        '@base-ui/react/button',
        '@base-ui/react/checkbox',
        '@base-ui/react/popover',
        '@base-ui/react/collapsible',
        '@base-ui/react/menu',
        '@base-ui/react/merge-props',
        '@base-ui/react/use-render',
        '@lexical/clipboard',
        '@opentelemetry/api',
        'motion/react-m',
        'posthog-js/rrweb',
        'react/jsx-dev-runtime',
        'strip-ansi',
        'zod',
        'zustand',
        'motion/react',
        'class-variance-authority',
        'clsx',
        'tailwind-merge',
      ],
    },
    server: { host: '127.0.0.1', port: 0 },
    plugins: [
      tailwindcss(),
      {
        name: 'question-interaction-fixture',
        resolveId(id) {
          if (id === '/question-fixture') return '\0question-fixture';
        },
        load(id) {
          if (id === '\0question-fixture') return questionInteractionFixture;
        },
        configureServer(vite) {
          vite.middlewares.use(async (req, res, next) => {
            if (req.method === 'POST' && req.url?.startsWith('/api/user-input/')) {
              if (!rejectionHost) throw new Error('The isolated rejection fixture is not ready.');
              let body = '';
              for await (const chunk of req) body += chunk.toString();
              const rejection = await rejectionHost.request(
                req.url.slice(4),
                'POST',
                JSON.parse(body),
              );
              res.statusCode = rejection.response.status;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify(rejection.result));
              return;
            }
            if (!req.url?.startsWith('/chat/fixture')) return next();
            res.setHeader('Content-Type', 'text/html');
            res.end(
              await vite.transformIndexHtml(
                '/chat/fixture',
                `<!doctype html><html data-interface="clay"><head><link rel="icon" href="data:,"><style>[hidden]{display:none!important}#root{max-width:1100px;margin:auto}</style></head><body><div id="root"></div><script type="module" src="/question-fixture"></script></body></html>`,
              ),
            );
          });
        },
      },
    ],
  });
  await server.listen();
  const address = server.httpServer!.address();
  if (!address || typeof address === 'string') throw new Error('Fixture server has no port.');
  url = `http://127.0.0.1:${address.port}/chat/fixture`;
  // Compile the actual CSS during setup, rather than timing cold Tailwind work as an interaction.
  const stylesheet = await fetch(new URL('/src/styles.css', url));
  if (!stylesheet.ok) throw new Error(await stylesheet.text());
  await stylesheet.text();
  browser = await chromium.launch({ headless: true });
}, 60000);
afterAll(async () => {
  await browser?.close();
  await server?.close();
  await cleanup();
  if (cache) await rm(cache, { recursive: true, force: true });
});
const fresh = async (surface = 'chat', options: Parameters<Browser['newPage']>[0] = {}) => {
  const page = await browser.newPage(options);
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.route('**/api/**', (route) => route.abort('blockedbyclient'));
  await page.goto(`${url}?surface=${surface}`);
  try {
    await page.waitForFunction(() => !!window.fixture, undefined, { timeout: 8000 });
  } catch {
    throw new Error(`Question fixture failed to mount: ${errors.join('; ')}`);
  }
  return page;
};
const state = (page: Page) => page.evaluate(() => window.fixture.read());
const focused = async (page: Page, selector: string) => {
  try {
    await page.waitForFunction(
      (target) => document.querySelector(target) === document.activeElement,
      selector,
      { timeout: 2000 },
    );
  } catch {
    throw new Error(
      `Expected focus on ${selector}: ${JSON.stringify(await page.evaluate(() => ({ state: window.fixture.read(), active: document.activeElement?.outerHTML })))}`,
    );
  }
};
const arrive = async (page: Page) => {
  await page.locator('.chat-textarea').focus();
  await page.evaluate(() => window.fixture.arrive());
  await page.waitForFunction(() => document.activeElement?.id === 'answer-fixture-question');
};

it('continues typing "a b" and digits into the answer after arrival without activating any choice', async () => {
  const page = await fresh();
  await arrive(page);
  await page.keyboard.type('a b2', { delay: 25 });
  await page.waitForTimeout(300);
  expect(await page.locator('#answer-fixture-question').inputValue()).toBe('a b2');
  expect((await state(page)).requests).toEqual([]);
  expect(await page.getByRole('dialog').count()).toBe(0);
  expect(await page.locator('#answer-fixture-question').getAttribute('aria-describedby')).toContain(
    'question-title-fixture-question',
  );
  await page.close();
});

it('latches a cleared Lexical draft through blur until question collapse/reopen', async () => {
  const page = await fresh();
  await arrive(page);
  await page.locator('#write').click();
  const draft = page.locator('.chat-textarea');
  await draft.fill('abc');
  await page.evaluate(() => window.fixture.setOpen(true));
  await draft.focus();
  await page.keyboard.press('Control+A');
  await page.keyboard.press('Backspace');
  await page.keyboard.type('a b', { delay: 25 });
  expect(await draft.innerText()).toBe('a b');
  await expect.poll(async () => (await state(page)).draft).toBe('a b');
  expect(await draft.evaluate((element) => element === document.activeElement)).toBe(true);
  expect((await state(page)).requests).toEqual([]);
  // Exercise Lexical's keyboard selection/deletion instead of fill's synthetic DOM selection.
  await draft.press('ControlOrMeta+A');
  await draft.press('Backspace');
  await page.locator('#outside').click();
  expect((await state(page)).draft).toBe('');
  expect(await page.locator('#composer input[name="message"]').inputValue()).toBe('');
  expect(await draft.textContent()).toBe('');
  expect(
    await page
      .locator('#composer')
      .evaluate((element) => element instanceof HTMLElement && element.hidden),
  ).toBe(false);
  expect(
    await page.locator('#outside').evaluate((element) => element === document.activeElement),
  ).toBe(true);
  expect(await page.locator('#write').count()).toBe(0);
  await page.evaluate(() => window.fixture.setOpen(false));
  await page.evaluate(() => window.fixture.setOpen(true));
  await page.waitForFunction(() => document.getElementById('composer')?.hidden);
  await page.close();
});

it('retains typed response and caret while saving and after a failed answer', async () => {
  const page = await fresh();
  await arrive(page);
  const answer = page.locator('#answer-fixture-question');
  await answer.fill('A preserved answer');
  await page.getByRole('button', { name: 'Answer and continue', exact: true }).click();
  await page.waitForFunction(() => window.fixture.read().working);
  expect(
    await answer.evaluate(
      (element) =>
        element instanceof HTMLTextAreaElement &&
        element === document.activeElement &&
        element.readOnly,
    ),
  ).toBe(true);
  await page.evaluate(() => window.fixture.fail());
  await page.locator('#answer-error-fixture-question').waitFor();
  expect(await answer.inputValue()).toBe('A preserved answer');
  expect(
    await answer.evaluate(
      (element) =>
        element instanceof HTMLTextAreaElement &&
        element === document.activeElement &&
        !element.readOnly,
    ),
  ).toBe(true);
  expect(await answer.getAttribute('aria-describedby')).toContain('answer-error-fixture-question');
  expect((await state(page)).requests).toHaveLength(1);
  await page.close();
});

it('returns to the preserved composer after a successful answer without stealing a moved focus', async () => {
  for (const move of [false, true]) {
    const page = await fresh();
    await arrive(page);
    await page.locator('#answer-fixture-question').fill('a b');
    await page.getByRole('button', { name: 'Answer and continue', exact: true }).click();
    if (move) await page.locator('#outside').click();
    await page.evaluate(() => window.fixture.resolve());
    await page.waitForFunction(() => !window.fixture.read().pending);
    const target = page.locator(move ? '#outside' : '.chat-textarea');
    await target.waitFor({ state: 'visible' });
    await focused(page, move ? '#outside' : '.chat-textarea');
    expect((await state(page)).requests[0].body.text).toBe('a b');
    await page.close();
  }
});

it('keeps intentional body shortcuts and focuses a neutral surface during choice save', async () => {
  const page = await fresh();
  await arrive(page);
  await page
    .locator('#answer-fixture-question')
    .evaluate((element) => (element as HTMLElement).blur());
  await page.keyboard.press('2');
  await page.waitForFunction(() => window.fixture.read().requests.length === 1);
  expect((await state(page)).requests[0].body.selected).toEqual(['types']);
  expect(
    await page
      .locator('[data-question-choice-target]')
      .evaluate((element) => element === document.activeElement),
  ).toBe(true);
  await page.close();
});

it('typing a custom answer during confirmation cancels the choice instead of silently sending both', async () => {
  const page = await fresh();
  await arrive(page);
  await page.locator('#answer-fixture-question').fill('Before');
  await page.getByRole('button', { name: 'React rendering', exact: false }).click();
  await page.locator('#answer-fixture-question').fill('Before after');
  await page.waitForTimeout(260);
  expect((await state(page)).requests).toHaveLength(0);
  await page.getByRole('button', { name: 'Answer and continue', exact: true }).click();
  await page.waitForFunction(() => window.fixture.read().requests.length === 1);
  expect((await state(page)).requests[0].body).toEqual({
    selected: [],
    text: 'Before after',
  });
  await page.close();
});

it('keeps a new unrelated focus choice after a failed answer and supports explicit question cancellation', async () => {
  const page = await fresh();
  await arrive(page);
  await page.locator('#answer-fixture-question').fill('Preserved through failure');
  await page.getByRole('button', { name: 'Answer and continue', exact: true }).click();
  await page.locator('#outside').click();
  await page.evaluate(() => window.fixture.fail());
  await page.locator('#answer-error-fixture-question').waitFor();
  await focused(page, '#outside');
  expect(await page.locator('#answer-fixture-question').inputValue()).toBe(
    'Preserved through failure',
  );
  await page.getByRole('button', { name: 'Cancel question', exact: true }).click();
  await page.waitForFunction(() => window.fixture.read().working);
  await page.evaluate(() => window.fixture.resolve());
  await focused(page, '.chat-textarea');
  expect((await state(page)).requests).toHaveLength(2);
  await page.close();
});

it('waits briefly for revealed targets and abandons restoration after route or focus ownership changes', async () => {
  for (const change of ['reveal', 'route', 'focus']) {
    const page = await fresh();
    await page.locator('.chat-textarea').focus();
    await page.evaluate((change) => {
      const target = document.createElement('textarea');
      target.id = 'late-target';
      target.hidden = true;
      document.body.append(target);
      window.fixture.deferFocus(target.id);
      if (change === 'route') history.pushState({}, '', '/chat/another-thread');
      if (change !== 'reveal') document.getElementById('outside')?.focus();
      requestAnimationFrame(() =>
        requestAnimationFrame(() => {
          target.hidden = false;
        }),
      );
    }, change);
    await focused(page, change === 'reveal' ? '#late-target' : '#outside');
    await page.waitForTimeout(220);
    expect(
      await page
        .locator(change === 'reveal' ? '#late-target' : '#outside')
        .evaluate((element) => element === document.activeElement),
    ).toBe(true);
    await page.close();
  }
});

it('lets Decisions focus its next heading or empty state after its external submit button resolves', async () => {
  for (const surface of ['decisions', 'empty']) {
    const page = await fresh(surface);
    await page.locator('#answer-fixture-question').fill('A decision answer');
    await page.getByRole('button', { name: 'Answer and continue', exact: true }).click();
    await page.waitForFunction(() => window.fixture.read().working);
    expect(
      await page
        .locator('#answer-fixture-question')
        .evaluate((element) => element === document.activeElement),
    ).toBe(true);
    await page.evaluate(() => window.fixture.resolve());
    await focused(page, '#next-decision');
    expect(await page.locator('#next-decision').innerText()).toBe(
      surface === 'empty' ? 'No decisions waiting' : 'Next decision to review',
    );
    expect(await page.locator('.chat-textarea').count()).toBe(0);
    await page.close();
  }
});

it('keeps answer text and multiselect choices through actual question subtree navigation', async () => {
  const page = await fresh();
  await page.evaluate(() => window.fixture.arrive(true));
  const answer = page.locator('#answer-fixture-question');
  await answer.fill('My answer\nwith a second line');
  await page
    .getByRole('checkbox', { name: 'React rendering', exact: false })
    .check({ timeout: 2000 });
  await page.evaluate(() => window.fixture.navigate('another-thread'));
  await page.waitForFunction(() => !document.getElementById('answer-fixture-question'), undefined, {
    timeout: 2000,
  });
  await page.evaluate(() => window.fixture.navigate('fixture'));
  await answer.waitFor({ state: 'visible', timeout: 2000 });
  expect(await answer.inputValue()).toBe('My answer\nwith a second line');
  expect(
    await page
      .getByRole('checkbox', { name: 'React rendering', exact: false })
      .getAttribute('aria-checked'),
  ).toBe('true');
  expect((await state(page)).requests).toHaveLength(0);
  await page.close();
});

it('opens and focuses the next pending or newly arrived question after an answer', async () => {
  for (const next of ['pending', 'later']) {
    const page = await fresh();
    await arrive(page);
    if (next === 'pending') await page.evaluate(() => window.fixture.second());
    await page.locator('#answer-fixture-question').fill('First answer');
    await page.getByRole('button', { name: 'Answer and continue', exact: true }).click();
    await page.evaluate(() => window.fixture.resolve());
    if (next === 'later') {
      await focused(page, '.chat-textarea');
      await page.evaluate(() => window.fixture.second());
    }
    await focused(page, '#answer-second-question');
    await page.keyboard.type('a b');
    expect(await page.locator('#answer-second-question').inputValue()).toBe('a b');
    expect((await state(page)).requests).toHaveLength(1);
    await page.close();
  }
});

it('opens a genuinely new question after Write-for-later collapsed the known question', async () => {
  const page = await fresh();
  await arrive(page);
  await page.locator('#write').click();
  await focused(page, '.chat-textarea');
  await page.evaluate(() => window.fixture.second());
  await focused(page, '#answer-second-question');
  expect((await state(page)).activeQuestionId).toBe('second-question');
  await page.close();
});

it('does not drop pointer-up or detach Add context after a draft is cleared', async () => {
  for (const action of ['choice', 'menu']) {
    const page = await fresh();
    await arrive(page);
    await page.locator('#write').click();
    const draft = page.locator('.chat-textarea');
    await draft.fill('abc');
    await page.evaluate(() => window.fixture.setOpen(true));
    await draft.focus();
    await draft.fill('');
    await page.waitForTimeout(220);
    if (action === 'choice') {
      const choice = page.getByRole('button', { name: 'TypeScript types', exact: false });
      const before = (await choice.boundingBox())!;
      await page.mouse.move(before.x + before.width / 2, before.y + before.height / 2);
      await page.mouse.down();
      await page.waitForTimeout(120);
      const during = (await choice.boundingBox())!;
      expect(Math.abs(during.y - before.y)).toBeLessThan(1);
      await page.mouse.up();
      await page.waitForFunction(() => window.fixture.read().requests.length === 1);
      expect((await state(page)).requests[0].body.selected).toEqual(['types']);
    } else {
      const trigger = page.locator('#add-context'),
        before = (await trigger.boundingBox())!;
      await trigger.click();
      const menu = page.getByRole('menu');
      await menu.waitFor();
      const position = (await menu.boundingBox())!;
      expect(position.y).toBeGreaterThan(before.y);
      expect(Math.abs(position.x - before.x)).toBeLessThan(20);
      expect(
        await page
          .locator('#composer')
          .evaluate((element) => element instanceof HTMLElement && element.hidden),
      ).toBe(false);
    }
    await page.close();
  }
});

it('keeps unrelated work from locking typing and grows a long answer within a cap', async () => {
  const page = await fresh();
  await arrive(page);
  await page.evaluate(() => window.fixture.setWorking(true));
  await page.keyboard.type('before during');
  const answer = page.locator('#answer-fixture-question');
  expect(await answer.inputValue()).toBe('before during');
  expect(
    await answer.evaluate((element) => element instanceof HTMLTextAreaElement && element.readOnly),
  ).toBe(false);
  await answer.fill(Array.from({ length: 30 }, (_, index) => `Answer line ${index}`).join('\n'));
  const box = (await answer.boundingBox())!;
  expect(box.height).toBeGreaterThan(100);
  expect(box.height).toBeLessThanOrEqual(280);
  expect((await state(page)).requests).toHaveLength(0);
  await page.close();
});

it('retains a question-specific lock across navigation while its own response is in flight', async () => {
  const page = await fresh();
  await arrive(page);
  await page.locator('#answer-fixture-question').fill('Kept while saving');
  await page.getByRole('button', { name: 'Answer and continue', exact: true }).click();
  await page.evaluate(() => window.fixture.navigate('another-thread'));
  await page.evaluate(() => window.fixture.navigate('fixture'));
  const answer = page.locator('#answer-fixture-question');
  await answer.waitFor({ state: 'visible' });
  expect(await answer.inputValue()).toBe('Kept while saving');
  expect(
    await answer.evaluate((element) => element instanceof HTMLTextAreaElement && element.readOnly),
  ).toBe(true);
  expect((await state(page)).requests).toHaveLength(1);
  await page.evaluate(() => window.fixture.resolve());
  await page.close();
});

it('uses GET-only reconciliation for accepted refresh failure without losing draft or repeating POST', async () => {
  const page = await fresh();
  await arrive(page);
  const answer = page.locator('#answer-fixture-question');
  await answer.fill('An accepted response');
  await page.getByRole('button', { name: 'Answer and continue', exact: true }).click();
  await page.evaluate(() => window.fixture.accept());
  await page.getByRole('button', { name: 'Check question status', exact: true }).waitFor();
  expect(await answer.inputValue()).toBe('An accepted response');
  expect(await page.locator('#answer-status-fixture-question').innerText()).toContain(
    'Answer accepted',
  );
  expect((await state(page)).requests).toHaveLength(1);
  expect((await state(page)).requests[0].options).toEqual({ errorToast: false });
  await page.evaluate(() => window.fixture.allowRefresh());
  await page.getByRole('button', { name: 'Check question status', exact: true }).click();
  await focused(page, '#outside');
  expect((await state(page)).requests).toHaveLength(1);
  expect((await state(page)).refreshes).toBeGreaterThanOrEqual(2);
  await page.close();
});

it('associates the Decisions external Cancel control and restores focus on both outcomes', async () => {
  for (const success of [false, true]) {
    const page = await fresh('decisions');
    await page.locator('#answer-fixture-question').fill('Retain if cancellation fails');
    await page.getByRole('button', { name: 'Cancel question', exact: true }).click();
    await page.waitForFunction(() => window.fixture.read().working);
    await page.evaluate(
      (success) => (success ? window.fixture.resolve() : window.fixture.fail()),
      success,
    );
    if (success) await focused(page, '#next-decision');
    else {
      await focused(page, '#answer-fixture-question');
      await page.locator('#answer-error-fixture-question').waitFor();
      expect(await page.locator('#answer-error-fixture-question').innerText()).toContain(
        'Could not cancel this question',
      );
      expect(await page.locator('#answer-fixture-question').inputValue()).toBe(
        'Retain if cancellation fails',
      );
    }
    await page.close();
  }
});

it('reveals settled actions on short-column reopen and focused growth without stealing focus or reading scroll', async () => {
  const page = await fresh();
  await page.setViewportSize({ width: 844, height: 390 });
  await page.addStyleTag({
    content:
      '.chat-panel{height:360px;overflow-y:auto}.chat-panel>h1{height:48px}.chat-panel>#outside{margin-bottom:220px}',
  });
  await arrive(page);
  const trigger = page.locator('.pending-question-trigger');
  await trigger.click();
  await page.waitForTimeout(220);
  await trigger.click();
  await page.waitForTimeout(260);
  await focused(page, '.pending-question-trigger');
  const visibleActions = () =>
    page.getByRole('button', { name: 'Answer and continue', exact: true }).evaluate((button) => {
      const column = button.closest('.chat-panel')!.getBoundingClientRect();
      const box = button.getBoundingClientRect();
      return box.top >= column.top && box.bottom <= column.bottom + 1;
    });
  expect(await visibleActions()).toBe(true);
  await page
    .locator('#answer-fixture-question')
    .fill(Array.from({ length: 30 }, (_, i) => `Long answer ${i}`).join('\n'));
  await page.waitForTimeout(180);
  expect(await visibleActions()).toBe(true);
  expect((await page.locator('#answer-fixture-question').boundingBox())!.height).toBeGreaterThan(
    100,
  );
  await page.waitForTimeout(420);
  await page.locator('.chat-panel').evaluate((column) => {
    column.dispatchEvent(new WheelEvent('wheel', { bubbles: true, deltaY: -150 }));
    column.scrollTop = 0;
    const dock = column.querySelector<HTMLElement>('.pending-user-questions')!;
    dock.style.paddingBottom = '100px';
  });
  await page.waitForTimeout(120);
  expect(await page.locator('.chat-panel').evaluate((column) => column.scrollTop)).toBe(0);
  expect((await state(page)).requests).toHaveLength(0);
  await page.close();
});

it('clips a translated entrance without letting native answer focus scroll the animation stage', async () => {
  const page = await fresh();
  await arrive(page);
  await page.locator('#outside').focus();
  const result = await page.locator('.pending-question-stage').evaluate((stage) => {
    const lane = stage.querySelector<HTMLElement>('.pending-user-questions-lane')!;
    lane.style.transform = 'translateY(160px)';
    stage.querySelector<HTMLTextAreaElement>('textarea')!.focus();
    const focusScroll = stage.scrollTop;
    stage.scrollTop = 80;
    const forcedScroll = stage.scrollTop;
    lane.style.transform = 'translateY(0px)';
    return {
      supported: CSS.supports('overflow', 'clip'),
      overflow: getComputedStyle(stage).overflowY,
      focusScroll,
      forcedScroll,
    };
  });
  expect(result).toEqual({ supported: true, overflow: 'clip', focusScroll: 0, forcedScroll: 0 });
  await focused(page, '#answer-fixture-question');
  expect((await state(page)).requests).toHaveLength(0);
  await page.close();
});

it('renders compact shared checkboxes and full label targets with compiled app CSS in chat and Decisions', async () => {
  for (const surface of ['chat', 'decisions']) {
    for (const width of [1440, 390]) {
      const page = await fresh(surface, { viewport: { width, height: 900 } });
      if (surface === 'chat') await page.evaluate(() => window.fixture.arrive(true));
      else await page.evaluate(() => window.fixture.multiselect());
      const checkbox = page.getByRole('checkbox', { name: 'React rendering', exact: false });
      await checkbox.waitFor();
      await page.evaluate(() => document.fonts.ready);
      const box = (await checkbox.boundingBox())!;
      expect(box.width).toBeGreaterThanOrEqual(14);
      expect(box.width).toBeLessThanOrEqual(24);
      expect(box.height).toBeGreaterThanOrEqual(14);
      expect(box.height).toBeLessThanOrEqual(24);
      expect(await checkbox.evaluate((element) => getComputedStyle(element).flexGrow)).toBe('0');
      const label = checkbox.locator('..');
      expect((await label.boundingBox())!.height).toBeGreaterThanOrEqual(44);
      expect((await label.locator('.user-question-option-label').boundingBox())!.x).toBeGreaterThan(
        box.x + box.width,
      );
      await checkbox.check();
      expect(await checkbox.getAttribute('aria-checked')).toBe('true');
      await page.close();
    }
  }
});

it('treats a second digit as a corrected choice and ignores held-key repeats without typing into the answer', async () => {
  for (const correction of [true, false]) {
    const page = await fresh();
    await arrive(page);
    await page
      .locator('#answer-fixture-question')
      .evaluate((element) => (element as HTMLElement).blur());
    await page.keyboard.down('1');
    await page.waitForTimeout(40);
    if (correction) {
      await page.keyboard.up('1');
      await page.keyboard.press('2');
    } else {
      await page.keyboard.down('1');
      await page.keyboard.up('1');
    }
    await page.waitForFunction(() => window.fixture.read().requests.length === 1);
    expect((await state(page)).requests[0].body).toEqual({
      selected: [correction ? 'types' : 'react'],
      text: '',
    });
    await focused(page, '[data-question-choice-target]');
    await page.waitForTimeout(230);
    expect((await state(page)).requests).toHaveLength(1);
    await page.close();
  }
});

it('keeps a coarse-pointer choice and its successful completion away from text inputs', async () => {
  const page = await fresh('chat', {
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: true,
  });
  await arrive(page);
  await page.getByRole('button', { name: 'React rendering', exact: false }).tap();
  await page.waitForFunction(() => window.fixture.read().requests.length === 1);
  await focused(page, '[data-question-choice-target]');
  await page.keyboard.type('N');
  expect((await state(page)).newJobs).toBe(0);
  await page.evaluate(() => window.fixture.resolve());
  await focused(page, '#outside');
  expect(
    await page.locator('.chat-textarea').evaluate((element) => element === document.activeElement),
  ).toBe(false);
  await page.close();
});

it('never uses digits from unrelated navigation or browser controls to answer a question', async () => {
  const page = await fresh();
  await arrive(page);
  await page.evaluate(() => {
    for (const [id, role] of [
      ['sidebar', 'link'],
      ['crew-tab', 'tab'],
      ['browser-control', 'button'],
    ]) {
      const button = document.createElement('button');
      button.id = id;
      button.setAttribute('role', role);
      button.textContent = id;
      document.body.append(button);
    }
  });
  for (const id of ['outside', 'sidebar', 'crew-tab', 'browser-control']) {
    await page.locator(`#${id}`).focus();
    await page.keyboard.press('2');
    await page.waitForTimeout(240);
  }
  expect((await state(page)).requests).toHaveLength(0);
  await page.close();
});

it('drops a failed single choice when a custom answer is edited', async () => {
  const page = await fresh();
  await arrive(page);
  await page.getByRole('button', { name: 'React rendering', exact: false }).click();
  await page.waitForFunction(() => window.fixture.read().requests.length === 1);
  await page.evaluate(() => window.fixture.fail());
  await page.locator('#answer-error-fixture-question').waitFor();
  await page.locator('#answer-fixture-question').fill('Neither, a different exercise');
  expect(
    await page
      .getByRole('button', { name: 'React rendering', exact: false })
      .getAttribute('aria-pressed'),
  ).toBe('false');
  await page.getByRole('button', { name: 'Answer and continue', exact: true }).click();
  await page.waitForFunction(() => window.fixture.read().requests.length === 2);
  expect((await state(page)).requests[1].body).toEqual({
    selected: [],
    text: 'Neither, a different exercise',
  });
  await page.close();
});

const prepareRejectionFixture = async () => {
  if (rejectionHost) return rejectionHost;
  rejectionHost = await setup(23973, false, { dev: false, ui: false });
  const service = rejectionHost.daemon.service;
  const role = service.board.get<Role>('role', 'writer');
  service.board.record(
    'role',
    { ...role, enabled: true },
    'user',
    'Isolated question rejection fixture',
  );
  const conversation = service.createConversation({
    title: 'Isolated rejection fixture',
    participants: ['reviewer'],
  });
  service.board.record(
    'user_input',
    {
      id: 'fixture-question',
      threadId: conversation.id,
      sourceThreadId: conversation.id,
      roleId: 'writer',
      runId: randomUUID(),
      messageId: randomUUID(),
      cardId: null,
      question: 'A synthetic question from a role that cannot read this conversation',
      reason: '',
      continuationNotes: '',
      options: [],
      multiSelect: false,
      createdAt: new Date().toISOString(),
      status: 'pending',
    } satisfies UserInputRequest,
    'user',
    'Isolated pending question fixture',
  );
  return rejectionHost;
};
it('preserves an actual fixture-daemon HTTP rejection and blocks an unchanged rejected payload without starting a runtime', async () => {
  const host = await prepareRejectionFixture();
  const service = host.daemon.service;
  const page = await fresh();
  await arrive(page);
  await page.route('**/api/user-input/**', (route) => route.continue());
  await page.evaluate(() => window.fixture.rejectHttp());
  await page.locator('#answer-fixture-question').fill('A response the server rejects');
  const rejected = page.waitForResponse(
    (response) =>
      response.url().includes('/api/user-input/') && response.request().method() === 'POST',
  );
  const submit = page.getByRole('button', { name: 'Answer and continue', exact: true });
  await submit.click();
  expect((await rejected).status()).toBe(400);
  const error = page.locator('#answer-error-fixture-question');
  await error.waitFor();
  expect(await error.innerText()).toBe(
    'The asking agent no longer participates in this conversation.',
  );
  expect(await submit.isDisabled()).toBe(true);
  expect(await page.locator('#answer-fixture-question').inputValue()).toBe(
    'A response the server rejects',
  );
  await page.locator('#answer-fixture-question').fill('A changed response');
  expect(await submit.isEnabled()).toBe(true);
  expect((await state(page)).requests).toHaveLength(1);
  expect(service.board.get<UserInputRequest>('user_input', 'fixture-question').status).toBe(
    'pending',
  );
  expect(service.board.list('run')).toHaveLength(0);
  expect(service.board.list('chat_request')).toHaveLength(0);
  await page.close();
});

it('keeps an HTTP400 with failed status reads locked and never repeats its POST', async () => {
  await prepareRejectionFixture();
  const page = await fresh();
  await arrive(page);
  await page.route('**/api/user-input/**', (route) => route.continue());
  await page.evaluate(() => {
    window.fixture.rejectHttp();
    window.fixture.failRefresh();
  });
  await page.locator('#answer-fixture-question').fill('Keep this ambiguous response');
  const rejected = page.waitForResponse(
    (response) =>
      response.url().includes('/api/user-input/') && response.request().method() === 'POST',
  );
  const submit = page.getByRole('button', { name: 'Answer and continue', exact: true });
  await submit.click();
  expect((await rejected).status()).toBe(400);
  const check = page.getByRole('button', { name: 'Check question status', exact: true });
  await check.waitFor();
  const notice = page.locator('#answer-status-fixture-question');
  expect(await notice.innerText()).toContain(
    'The asking agent no longer participates in this conversation.',
  );
  expect(await notice.innerText()).toContain('Could not confirm');
  expect(await submit.isDisabled()).toBe(true);
  expect(
    await page
      .locator('#answer-fixture-question')
      .evaluate((element) => element instanceof HTMLTextAreaElement && element.readOnly),
  ).toBe(true);
  await page.locator('.user-question-form').evaluate((form) => {
    if (form instanceof HTMLFormElement) form.requestSubmit();
  });
  for (let attempt = 0; attempt < 2; attempt++) {
    await check.click();
    await check.waitFor();
  }
  expect(await notice.innerText()).toContain(
    'The asking agent no longer participates in this conversation.',
  );
  expect(await notice.innerText()).toContain("Still can't confirm");
  expect((await state(page)).requests).toHaveLength(1);
  expect((await state(page)).refreshes).toBeGreaterThanOrEqual(3);
  await page.evaluate(() => window.fixture.allowRefresh());
  await check.click();
  await page.locator('#answer-error-fixture-question').waitFor();
  expect(await page.locator('#answer-error-fixture-question').innerText()).toBe(
    'The asking agent no longer participates in this conversation.',
  );
  expect(await submit.isDisabled()).toBe(true);
  expect((await state(page)).requests).toHaveLength(1);
  await page.close();
});

it('keeps an ambiguous save locked and gives repeat GET checks fresh quiet feedback', async () => {
  const page = await fresh();
  await arrive(page);
  await page.locator('#answer-fixture-question').fill('Unknown save outcome');
  await page.getByRole('button', { name: 'Answer and continue', exact: true }).click();
  await page.evaluate(() => window.fixture.loseConnection());
  const check = page.getByRole('button', { name: 'Check question status', exact: true });
  await check.waitFor();
  const notice = page.locator('#answer-status-fixture-question');
  expect(await notice.innerText()).toContain('Could not confirm');
  expect(await notice.innerText()).not.toContain("wasn't saved");
  expect((await check.boundingBox())!.width).toBeLessThan(
    (await page.locator('.user-question-custom').boundingBox())!.width,
  );
  await check.click();
  await check.waitFor();
  expect(await notice.innerText()).toContain("Still can't confirm");
  expect((await state(page)).requests).toHaveLength(1);
  await page.close();
});

it('retains externally resolved drafts and never redirects continued typing to a message', async () => {
  for (const surface of ['chat', 'decisions']) {
    const page = await fresh(surface);
    if (surface === 'chat') await arrive(page);
    await page.locator('#answer-fixture-question').fill('12 words to recover');
    await page.evaluate(() => window.fixture.externalResolve());
    await focused(page, '#question-response-recovery-fixture-question');
    await page.keyboard.type(' continuing2');
    await page.keyboard.press('Enter');
    expect(await page.locator('.question-response-recovery blockquote').innerText()).toBe(
      '12 words to recover',
    );
    expect((await state(page)).requests).toHaveLength(0);
    expect((await state(page)).newJobs).toBe(0);
    if (surface === 'chat')
      expect((await page.locator('.chat-textarea').innerText()).trim()).toBe('');
    await page.close();
  }
});

it('collapses all known questions once and identifies each preview while a new question still opens', async () => {
  const page = await fresh();
  await arrive(page);
  await page.evaluate(() => {
    window.fixture.second();
  });
  await page.evaluate(() => {
    window.fixture.extra('third-question');
  });
  const trigger = page.locator('[data-question-id="fixture-question"] .pending-question-trigger');
  await trigger.click();
  expect(await page.locator('.pending-question-trigger[aria-expanded="true"]').count()).toBe(0);
  expect(await trigger.innerText()).toContain('Which frontend topic');
  expect(
    await page
      .locator('[data-question-id="second-question"] .pending-question-trigger')
      .innerText(),
  ).toContain('Which example');
  await page.evaluate(() => window.fixture.extra('new-question'));
  expect(
    await page
      .locator('[data-question-id="new-question"] .pending-question-trigger')
      .getAttribute('aria-expanded'),
  ).toBe('true');
  await page.close();
});

it('keeps the composer visible and neutral after removing its focused last attachment', async () => {
  const page = await fresh();
  await page.evaluate(() => window.fixture.addFile());
  await page.locator('.chat-textarea').focus();
  await page.evaluate(() => window.fixture.arrive());
  await page.getByRole('button', { name: 'Remove practice.txt', exact: true }).click();
  await focused(page, '#composer');
  expect(
    await page
      .locator('#composer')
      .evaluate((element) => element instanceof HTMLElement && element.hidden),
  ).toBe(false);
  expect(await page.locator('#write').count()).toBe(0);
  await page.locator('#add-context').click();
  await page.getByRole('menu').waitFor();
  expect((await state(page)).requests).toHaveLength(0);
  await page.close();
});

declare global {
  interface Window {
    fixture: {
      arrive: (multi?: boolean) => void;
      second: () => void;
      multiselect: () => void;
      extra: (id: string) => void;
      rejectHttp: () => void;
      failRefresh: () => void;
      loseConnection: () => void;
      externalResolve: () => void;
      addFile: () => void;
      navigate: (thread: string) => void;
      setWorking: (working: boolean) => void;
      accept: () => void;
      allowRefresh: () => void;
      setOpen: (open: boolean) => void;
      resolve: () => void;
      fail: () => void;
      deferFocus: (id: string) => void;
      read: () => {
        draft: string;
        pending: boolean;
        working: boolean;
        activeQuestionId?: string;
        refreshes: number;
        newJobs: number;
        requests: {
          body: { text: string; selected: string[] };
          options?: { errorToast?: boolean };
        }[];
      };
    };
  }
}
