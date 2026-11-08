import { afterAll, beforeAll, expect, it } from 'vitest';
import { chromium, type Browser } from 'playwright';
import { createServer, type ViteDevServer } from 'vite';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { composerInteractionFixture } from './composer-interaction-fixture.ts';

let server: ViteDevServer, browser: Browser, cache: string, url: string;
beforeAll(async () => {
  const root = fileURLToPath(new URL('../../..', import.meta.url)),
    design = createRequire(join(root, '../design-system/package.json'));
  cache = await mkdtemp(join(tmpdir(), 'pitchcrew-composer-ui-'));
  server = await createServer({
    root,
    configFile: false,
    cacheDir: cache,
    resolve: {
      alias: {
        '@': join(root, 'src'),
        ...Object.fromEntries(
          ['class-variance-authority', 'clsx', 'tailwind-merge'].map((name) => [
            name,
            design.resolve(name),
          ]),
        ),
      },
    },
    optimizeDeps: {
      entries: [],
      include: [
        'react',
        'react-dom/client',
        'react/jsx-dev-runtime',
        '@tanstack/react-router',
        'lucide-react',
        'lexical',
        '@lexical/react/LexicalComposer',
        '@lexical/react/LexicalHistoryPlugin',
        '@lexical/react/LexicalContentEditable',
        '@lexical/react/LexicalPlainTextPlugin',
        '@lexical/react/LexicalErrorBoundary',
        '@lexical/react/LexicalComposerContext',
        '@lexical/clipboard',
        '@base-ui/react/button',
        '@base-ui/react/dialog',
        '@base-ui/react/input',
        '@base-ui/react/menu',
        '@base-ui/react/popover',
        '@base-ui/react/collapsible',
        '@base-ui/react/checkbox',
        '@base-ui/react/merge-props',
        '@base-ui/react/select',
        '@base-ui/react/tooltip',
        '@base-ui/react/use-render',
        '@opentelemetry/api',
        'cmdk',
        'posthog-js/no-external',
        'posthog-js/rrweb',
        'strip-ansi',
        'zod',
        'zustand',
        'motion/react',
        'motion/react-m',
        'class-variance-authority',
        'clsx',
        'tailwind-merge',
      ],
    },
    server: { host: '127.0.0.1', port: 0 },
    plugins: [
      {
        name: 'composer-fixture',
        resolveId: (id) => (id === '/composer-fixture' ? '\0composer-fixture' : undefined),
        load: (id) => (id === '\0composer-fixture' ? composerInteractionFixture : undefined),
        configureServer(vite) {
          vite.middlewares.use(async (req, res, next) => {
            if (
              !req.url?.startsWith('/chat/') &&
              !['/board', '/crew', '/inbox'].includes(req.url ?? '')
            )
              return next();
            res.setHeader('Content-Type', 'text/html');
            res.end(
              await vite.transformIndexHtml(
                '/chat/a',
                '<!doctype html><html><head><link rel="icon" href="data:,"><style>[hidden]{display:none!important}button,input,textarea,a,[contenteditable]{margin:6px;padding:8px}svg{width:16px;height:16px}[contenteditable]{min-height:40px;border:1px solid gray}.sr-only{position:absolute;clip-path:inset(50%);width:1px;height:1px;overflow:hidden}</style></head><body><div id="root"></div><script type="module" src="/composer-fixture"></script></body></html>',
              ),
            );
          });
        },
      },
    ],
  });
  await server.listen();
  const address = server.httpServer!.address();
  if (!address || typeof address === 'string') throw Error('No fixture port');
  url = `http://127.0.0.1:${address.port}`;
  browser = await chromium.launch();
  // Compile the cold Vite module graph inside the setup budget, not the
  // first composer's five-second interaction deadline. Each test stays isolated.
  const warmup = await fresh(30000);
  await warmup.close();
}, 60000);
afterAll(async () => {
  await browser?.close();
  await server?.close();
  if (cache) await rm(cache, { recursive: true, force: true });
});
const fresh = async (timeout = 5000) => {
  const page = await browser.newPage();
  page.setDefaultTimeout(timeout);
  await page.route('**/api/**', (route) => route.abort('blockedbyclient'));
  await page.goto(url + '/chat/a');
  await page.waitForFunction(() => !!window.composerFixture);
  return page;
};

it('preserves actual atomic references and File identity through Board/Crew/Decisions unmounts', async () => {
  const page = await fresh();
  await page.evaluate(() => window.composerFixture.seed());
  for (const destination of ['board', 'crew', 'inbox']) {
    await page.getByRole('link', { name: destination, exact: true }).click();
    await page.getByRole('link', { name: 'Return to chat', exact: true }).click();
    await page.waitForFunction(
      () =>
        document.querySelector('.chat-compose input[name=message]')?.getAttribute('value') ===
        'Ask @career-coach now',
    );
    const state = await page.evaluate(() => window.composerFixture.read());
    expect(state.sameFile).toBe(true);
    expect(state.draft.references).toHaveLength(1);
    expect(state.draft.files[0]?.name).toBe('first.txt');
  }
  await page.locator('.browser-reply-input').fill('Ask @career-coach now and later');
  await page.waitForFunction(
    () =>
      document.querySelector('.chat-compose input[name=message]')?.getAttribute('value') ===
      'Ask @career-coach now and later',
  );
  expect((await page.evaluate(() => window.composerFixture.read())).draft.references).toHaveLength(
    1,
  );
  await page.close();
});

it('keeps real Lexical typing editable during unrelated work and a pending send across navigation', async () => {
  const page = await fresh(),
    input = page.locator('.chat-compose .chat-textarea');
  await input.click();
  await page.keyboard.insertText('before ');
  await page.evaluate(() => window.composerFixture.unrelated(true));
  expect(await input.getAttribute('contenteditable')).toBe('true');
  await page.keyboard.insertText('during 2');
  expect((await page.evaluate(() => window.composerFixture.read())).draft.text).toBe(
    'before during 2',
  );
  await page.evaluate(() => window.composerFixture.unrelated(false));
  await input.press('Enter');
  await page.keyboard.insertText('new typing 2');
  await page.waitForFunction(() => window.composerFixture.read().requests.length === 1);
  await page
    .locator('.chat-compose input[type=file]')
    .setInputFiles({ name: 'new.txt', mimeType: 'text/plain', buffer: Buffer.from('new') });
  await page.getByRole('link', { name: 'board', exact: true }).click();
  await page.getByRole('link', { name: 'Return to chat', exact: true }).click();
  await input.press('Enter');
  expect((await page.evaluate(() => window.composerFixture.read())).requests).toHaveLength(1);
  await page.evaluate(() => window.composerFixture.settle('success'));
  await page.waitForFunction(() => !window.composerFixture.read().sending);
  const state = await page.evaluate(() => window.composerFixture.read());
  expect(state.draft.text).toBe('new typing 2');
  expect(state.draft.files[0]?.name).toBe('new.txt');
  expect(state.requests[0]?.[4]).toEqual({ errorToast: false });
  await page.close();
});

it('keeps failed and newer payloads separate and reviews/swaps them without another request', async () => {
  const page = await fresh();
  await page.evaluate(() => window.composerFixture.seed());
  const input = page.locator('.chat-compose .chat-textarea');
  await input.press('Enter');
  await page.keyboard.insertText('new unsent draft');
  await page.waitForFunction(() => window.composerFixture.read().requests.length === 1);
  await page.evaluate(() => window.composerFixture.settle('fail'));
  await page.waitForFunction(() => window.composerFixture.read().kept.length === 1);
  expect((await page.evaluate(() => window.composerFixture.read())).draft.text).toBe(
    'new unsent draft',
  );
  await page
    .locator('.chat-compose')
    .getByRole('button', { name: 'Review 1 kept draft', exact: true })
    .click();
  await page.getByRole('button', { name: 'Use this draft', exact: true }).press('Enter');
  const state = await page.evaluate(() => window.composerFixture.read());
  expect(state.draft.text).toBe('Ask @career-coach now');
  expect(state.sameFile).toBe(true);
  expect(state.draft.references).toHaveLength(1);
  expect(state.kept[0]?.payload.text).toBe('new unsent draft');
  expect(state.requests).toHaveLength(1);
  await page.close();
});

it('keeps recovery dialogs scoped to their thread when navigating back', async () => {
  const page = await fresh();
  await page.evaluate(() => window.composerFixture.seedText('Retained in the first chat'));
  await page.locator('.chat-compose .chat-textarea').press('Enter');
  await page.waitForFunction(() => window.composerFixture.read().requests.length === 1);
  await page.evaluate(() => window.composerFixture.settle('fail'));
  await page.waitForFunction(() => window.composerFixture.read().kept.length === 1);
  await page.getByRole('link', { name: 'Other chat', exact: true }).click();
  await page.getByRole('link', { name: 'Return to chat', exact: true }).click();
  await page
    .locator('.chat-compose')
    .getByRole('button', { name: 'Review 1 kept draft', exact: true })
    .click();
  await page.getByRole('dialog').waitFor();
  await page.goBack();
  await page.waitForURL('**/chat/b');
  await page.waitForFunction(() => !document.querySelector('[role="dialog"]'));
  expect(
    await page
      .locator('.chat-compose')
      .getByRole('button', { name: /Review.*kept/ })
      .count(),
  ).toBe(0);
  await page.getByRole('link', { name: 'Return to chat', exact: true }).click();
  expect(await page.getByRole('dialog').count()).toBe(0);
  await page
    .locator('.chat-compose')
    .getByRole('button', { name: 'Review 1 kept draft', exact: true })
    .click();
  await page.getByText('Retained in the first chat', { exact: true }).waitFor();
  expect((await page.evaluate(() => window.composerFixture.read())).requests).toHaveLength(1);
  await page.close();
});

it('discards locally and focuses the next retained action or neutral empty-dialog heading', async () => {
  const page = await fresh(),
    input = page.locator('.chat-compose .chat-textarea');
  await page.evaluate(() => window.composerFixture.seed());
  await input.press('Enter');
  await page.keyboard.insertText('second unsent');
  await page.waitForFunction(() => window.composerFixture.read().requests.length === 1);
  await page.evaluate(() => window.composerFixture.settle('fail'));
  await page.waitForFunction(() => window.composerFixture.read().kept.length === 1);
  await input.press('Enter');
  await page.keyboard.insertText('current stays untouched');
  await page.waitForFunction(() => window.composerFixture.read().requests.length === 2);
  await page.evaluate(() => window.composerFixture.settle('fail'));
  await page.waitForFunction(() => window.composerFixture.read().kept.length === 2);
  await page
    .locator('.chat-compose')
    .getByRole('button', { name: 'Review 2 kept drafts', exact: true })
    .click();
  await page
    .getByRole('button', { name: 'Discard kept draft', exact: true })
    .first()
    .press('Enter');
  await page.waitForFunction(() => document.activeElement?.hasAttribute('data-kept-draft-use'));
  expect((await page.evaluate(() => window.composerFixture.read())).draft.text).toBe(
    'current stays untouched',
  );
  expect((await page.evaluate(() => window.composerFixture.read())).kept[0]?.payload.text).toBe(
    'second unsent',
  );
  await page.getByRole('button', { name: 'Discard kept draft', exact: true }).press('Enter');
  await page.waitForFunction(() => document.activeElement?.hasAttribute('data-kept-draft-heading'));
  expect(await page.getByText('No kept drafts.', { exact: true }).count()).toBe(1);
  const state = await page.evaluate(() => window.composerFixture.read());
  expect(state.draft.text).toBe('current stays untouched');
  expect(state.kept).toEqual([]);
  expect(state.requests).toHaveLength(2);
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => document.activeElement?.classList.contains('chat-compose'));
  await page.close();
});

it('keeps accepted-send acknowledgement and GET-only refresh visible across page trips with a pending question', async () => {
  const page = await fresh();
  await page.evaluate(() => {
    window.composerFixture.seedText('A held message');
    window.composerFixture.question();
  });
  const input = page.locator('.chat-compose .chat-textarea');
  await input.press('Enter');
  await page.waitForFunction(() => window.composerFixture.read().requests.length === 1);
  await page.evaluate(() => window.composerFixture.settle('accepted-refresh'));
  await page
    .locator('.chat-compose')
    .getByText('Message accepted. Refresh the conversation to see its status.', { exact: true })
    .waitFor();
  for (const destination of ['board', 'crew', 'inbox']) {
    await page.getByRole('link', { name: destination, exact: true }).click();
    await page.getByRole('link', { name: 'Return to chat', exact: true }).click();
    const composer = page.locator('.chat-compose');
    expect(await composer.isVisible()).toBe(true);
    expect(await composer.getAttribute('inert')).toBeNull();
    await composer.getByRole('button', { name: 'Refresh conversation', exact: true }).waitFor();
    expect((await page.evaluate(() => window.composerFixture.read())).refreshNeeded).toBe(true);
    expect(await page.locator('.pending-question-trigger').getAttribute('aria-expanded')).toBe(
      'true',
    );
  }
  await page
    .locator('.chat-compose')
    .getByRole('button', { name: 'Refresh conversation', exact: true })
    .click();
  await page.waitForFunction(() => !window.composerFixture.read().refreshNeeded);
  const state = await page.evaluate(() => window.composerFixture.read());
  expect(state.refreshes).toBe(1);
  expect(state.requests).toHaveLength(1);
  await page.close();
});

it('keeps an empty active editor visible while its own send is pending across a page trip and open question', async () => {
  const page = await fresh();
  await page.evaluate(() => {
    window.composerFixture.seedText('Only this message');
    window.composerFixture.question();
  });
  const input = page.locator('.chat-compose .chat-textarea');
  await input.press('Enter');
  await page.waitForFunction(() => window.composerFixture.read().requests.length === 1);
  expect((await page.evaluate(() => window.composerFixture.read())).draft.text).toBe('');
  await page.getByRole('link', { name: 'board', exact: true }).click();
  await page.getByRole('link', { name: 'Return to chat', exact: true }).click();
  expect(await page.locator('.chat-compose').isVisible()).toBe(true);
  expect(await input.getAttribute('contenteditable')).toBe('true');
  await input.press('Enter');
  expect((await page.evaluate(() => window.composerFixture.read())).requests).toHaveLength(1);
  expect((await page.evaluate(() => window.composerFixture.read())).sending).toBe(true);
  await page.evaluate(() => window.composerFixture.settle('success'));
  await page.close();
});

it('closes the last discarded recovery draft onto a visible neutral question control', async () => {
  const page = await fresh();
  await page.evaluate(() => {
    window.composerFixture.seedText('Keep then discard');
    window.composerFixture.question();
  });
  await page.locator('.chat-compose .chat-textarea').press('Enter');
  await page.waitForFunction(() => window.composerFixture.read().requests.length === 1);
  await page.evaluate(() => window.composerFixture.settle('fail'));
  await page
    .locator('.chat-compose')
    .getByRole('button', { name: 'Review 1 kept draft', exact: true })
    .click();
  await page.getByRole('button', { name: 'Discard kept draft', exact: true }).press('Enter');
  await page.waitForFunction(() => document.activeElement?.hasAttribute('data-kept-draft-heading'));
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => {
    const active = document.activeElement;
    return (
      active instanceof HTMLElement &&
      !!active.closest('.pending-user-question,.chat-heading') &&
      !active.closest('[hidden],[inert],[aria-hidden="true"]') &&
      active.getClientRects().length > 0
    );
  });
  const state = await page.evaluate(() => window.composerFixture.read());
  expect(state.kept).toHaveLength(0);
  expect(state.draft.text).toBe('');
  expect(state.requests).toHaveLength(1);
  expect(await page.locator('.chat-compose').isHidden()).toBe(true);
  expect(await page.locator('[role="dialog"]').count()).toBe(0);
  await page.close();
});

it('preserves a lost-send UUID through actual Lexical restoration, reference hydration and unchanged retry', async () => {
  const page = await fresh();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addStyleTag({
    content: [
      await readFile(new URL('../../styles/chat/composer.css', import.meta.url), 'utf8'),
      await readFile(new URL('../../styles/chat/clay-composer.css', import.meta.url), 'utf8'),
    ].join('\n'),
  });
  await page.evaluate(() => {
    document.documentElement.dataset.interface = 'clay';
  });
  await page.evaluate(() => window.composerFixture.seed());
  const input = page.locator('.chat-compose .chat-textarea');
  await input.press('Enter');
  await page.waitForFunction(() => window.composerFixture.read().requests.length === 1);
  const original = (await page.evaluate(() => window.composerFixture.read())).requests[0][2] as {
    clientRequestId: string;
  };
  await page.evaluate(() => window.composerFixture.settle('fail'));
  await page.waitForFunction(() => window.composerFixture.read().kept.length === 1);
  await page
    .locator('.chat-compose')
    .getByRole('button', { name: 'Review 1 kept draft', exact: true })
    .click();
  await page.getByRole('button', { name: 'Use this draft', exact: true }).press('Enter');
  const warning = page.locator('.chat-compose .chat-send-note');
  await warning.getByText('Retry keeps the original Queue action.', { exact: false }).waitFor();
  expect(await warning.isVisible()).toBe(true);
  expect(await warning.evaluate((element) => getComputedStyle(element).gridRowStart)).toBe('3');
  for (const destination of ['board', 'crew']) {
    await page.getByRole('link', { name: destination, exact: true }).click();
    await page.getByRole('link', { name: 'Return to chat', exact: true }).click();
    await page.waitForFunction(
      () =>
        document.querySelector('.chat-compose input[name=message]')?.getAttribute('value') ===
        'Ask @career-coach now',
    );
    expect((await page.evaluate(() => window.composerFixture.read())).draft.submission?.id).toBe(
      original.clientRequestId,
    );
  }
  expect(await input.locator('.chat-reference-token').count()).toBe(1);
  await input.press('Enter');
  await page.waitForFunction(() => window.composerFixture.read().requests.length === 2);
  const retried = (await page.evaluate(() => window.composerFixture.read())).requests[1][2] as {
    clientRequestId: string;
    references: unknown[];
  };
  expect(retried.clientRequestId).toBe(original.clientRequestId);
  expect(retried.references).toHaveLength(1);
  await page.evaluate(() => window.composerFixture.settle('success'));
  await page.close();
});

declare global {
  interface Window {
    composerFixture: {
      seed: () => void;
      seedText: (text: string) => void;
      question: () => void;
      unrelated: (value: boolean) => void;
      settle: (outcome: string) => void;
      read: () => {
        working: boolean;
        requests: unknown[][];
        draft: {
          text: string;
          references: unknown[];
          files: { name: string }[];
          submission?: { id: string };
        };
        kept: { payload: { text: string } }[];
        sending: boolean;
        sameFile: boolean;
        refreshNeeded: boolean;
        notice: string;
        refreshes: number;
      };
    };
  }
}
