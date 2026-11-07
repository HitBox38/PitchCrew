import { afterAll, beforeAll, expect, it } from 'vitest';
import { chromium, type Browser } from 'playwright';
import { createServer, type ViteDevServer } from 'vite';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { recoveryInteractionFixture } from './recovery-interaction-fixture.ts';

let server: ViteDevServer, browser: Browser, cache: string, url: string;
beforeAll(async () => {
  const root = fileURLToPath(new URL('../../..', import.meta.url));
  const design = createRequire(join(root, '../design-system/package.json'));
  cache = await mkdtemp(join(tmpdir(), 'pitchcrew-recovery-ui-'));
  server = await createServer({
    root,
    configFile: false,
    cacheDir: cache,
    resolve: {
      alias: {
        '@': join(root, 'src'),
        '@fixture-motion': join(root, '../design-system/src/styles/motion.css'),
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
        '@tanstack/react-router',
        'lucide-react',
        '@base-ui/react/button',
        '@base-ui/react/collapsible',
        '@base-ui/react/menu',
        '@base-ui/react/dialog',
        '@base-ui/react/input',
        'motion/react',
        'react/jsx-dev-runtime',
        'lexical',
        '@lexical/react/LexicalComposer',
        '@lexical/react/LexicalHistoryPlugin',
        '@lexical/react/LexicalContentEditable',
        '@lexical/react/LexicalPlainTextPlugin',
        '@lexical/react/LexicalErrorBoundary',
        '@lexical/react/LexicalComposerContext',
        'class-variance-authority',
        'clsx',
        'tailwind-merge',
      ],
    },
    server: { host: '127.0.0.1', port: 0 },
    plugins: [
      {
        name: 'recovery-interactions',
        resolveId: (id) => (id === '/recovery-fixture' ? '\0recovery-fixture' : undefined),
        load: (id) => (id === '\0recovery-fixture' ? recoveryInteractionFixture : undefined),
        configureServer(vite) {
          vite.middlewares.use(async (req, res, next) => {
            if (!req.url?.startsWith('/chat/') && req.url !== '/queue') return next();
            res.setHeader('Content-Type', 'text/html');
            res.end(
              await vite.transformIndexHtml(
                '/chat/current',
                '<!doctype html><html><head><link rel="icon" href="data:,"><style>:root{--ease:ease;--duration-press:100ms}[hidden]{display:none!important}button,input,a{margin:6px;padding:8px}svg{width:16px;height:16px}.chat-queue-content{height:120px;overflow:auto}.chat-queued-full-text{white-space:pre-wrap;line-height:20px}.chat-queue-content>div{min-height:120px}.sr-only{position:absolute;clip-path:inset(50%);width:1px;height:1px;overflow:hidden}</style></head><body><div id="root"></div><script type="module" src="/recovery-fixture"></script></body></html>',
              ),
            );
          });
        },
      },
    ],
  });
  await server.listen();
  const address = server.httpServer!.address();
  if (!address || typeof address === 'string') throw new Error('No fixture port');
  url = `http://127.0.0.1:${address.port}`;
  browser = await chromium.launch();
}, 60000);
afterAll(async () => {
  await browser?.close();
  await server?.close();
  if (cache) await rm(cache, { recursive: true, force: true });
});

it('navigates to the blocker through the real unsaved-change router guard with no recovery command', async () => {
  const page = await browser.newPage();
  page.setDefaultTimeout(5000);
  await page.route('**/api/**', (route) => route.abort('blockedbyclient'));
  await page.goto(url + '/chat/current');
  await page.getByRole('button', { name: 'Mark unsaved queue edit' }).click();
  const link = page.getByRole('link', {
    name: 'Open blocking chat: Review the unfinished work in Earlier discussion',
  });
  expect(await link.getAttribute('href')).toBe('/chat/other');
  await link.click();
  await page.getByRole('button', { name: 'Keep editing', exact: true }).press('Enter');
  expect(new URL(page.url()).pathname).toBe('/chat/current');
  expect(await page.getByLabel('Main draft').inputValue()).toBe(
    'Atomic reference draft remains here',
  );
  await link.click();
  await page.getByRole('button', { name: 'Discard changes', exact: true }).press('Enter');
  await page.waitForURL('**/chat/other');
  expect(await page.getByLabel('Main draft').inputValue()).toBe(
    'Atomic reference draft remains here',
  );
  expect(await page.evaluate(() => window.queueFixture.read().calls)).toEqual([]);
  expect(await page.getByRole('button', { name: 'Retry', exact: true }).count()).toBe(1);
  expect(await page.locator('.chat-queued-recover').count()).toBe(0);
  expect(await page.locator('.chat-send').getAttribute('aria-label')).toBe(
    'Queue message for after you retry',
  );
  await page.close();
});

it('shows shared recovery and truthful send labels in a new attached chat without foreign request rows', async () => {
  for (const kind of ['failed', 'interrupted', 'user']) {
    const page = await browser.newPage();
    await page.route('**/api/**', (route) => route.abort('blockedbyclient'));
    await page.goto(url + '/chat/fresh?kind=' + kind);
    const shared = page.getByRole('region', { name: 'Shared job queue', exact: true });
    await shared.waitFor();
    expect(await shared.innerText()).toContain('Earlier discussion');
    expect(await page.locator('.chat-queued-message').count()).toBe(0);
    expect(await page.locator('.chat-queued-full-text').count()).toBe(0);
    if (kind === 'user') {
      expect(await shared.getByRole('button', { name: 'Resume queue', exact: true }).count()).toBe(
        1,
      );
    } else {
      const link = shared.getByRole('link', { name: /^Open blocking chat:/ });
      expect(await link.innerText()).toBe('Open blocking chat');
      expect(await link.getAttribute('href')).toBe('/chat/other');
    }
    expect(await page.locator('.chat-send').getAttribute('aria-label')).toBe(
      kind === 'user'
        ? 'Queue message for after you resume'
        : 'Queue message for after this queue continues',
    );
    expect(await page.evaluate(() => window.queueFixture.read().calls)).toEqual([]);
    await page.close();
  }
  const page = await browser.newPage();
  await page.goto(url + '/chat/fresh?kind=failed&missing=1');
  const fallback = page.getByRole('link', { name: /^Open Queue:/ });
  expect(await fallback.innerText()).toBe('Open Queue');
  expect(await fallback.getAttribute('href')).toBe('/queue');
  await page.close();
});

it('reveals opened message text inside only its queue at desktop and phone sizes', async () => {
  for (const width of [1440, 320]) {
    const page = await browser.newPage({ viewport: { width, height: 700 } });
    await page.goto(url + '/chat/current');
    const trigger = page.locator('.chat-queued-preview');
    const before = await page.evaluate(() => window.scrollY);
    await trigger.click();
    await page.waitForTimeout(300);
    await page.waitForFunction(
      () => document.querySelector('.chat-queue-content')!.scrollTop > 80,
      undefined,
      { timeout: 2000 },
    );
    const position = await page.locator('.chat-queued-full-text').evaluate((text) => ({
      relative:
        text.getBoundingClientRect().top -
        text.closest('.chat-queue-content')!.getBoundingClientRect().top,
      active: document.activeElement?.classList.contains('chat-queued-preview'),
    }));
    expect(position.relative).toBeGreaterThanOrEqual(0);
    expect(position.relative).toBeLessThanOrEqual(9);
    expect(position.active).toBe(true);
    expect(await page.evaluate(() => window.scrollY)).toBe(before);
    expect(await page.locator('.chat-queue-scroll-hint').innerText()).toBe('Scroll for more');
    await page.close();
  }
});

it('releases animated message reveal when the user scrolls the queue', async () => {
  const page = await browser.newPage();
  await page.goto(url + '/chat/current');
  await page.locator('.chat-queued-preview').click();
  await page.waitForTimeout(40);
  const viewport = page.locator('.chat-queue-content');
  await viewport.hover();
  await page.mouse.wheel(0, -1000);
  await page.waitForTimeout(350);
  expect(await viewport.evaluate((element) => element.scrollTop)).toBe(0);
  expect(
    await page
      .locator('.chat-queued-preview')
      .evaluate((element) => element === document.activeElement),
  ).toBe(true);
  await page.close();
});

declare global {
  interface Window {
    queueFixture: { read: () => { calls: unknown[]; draft: string; dirty: boolean } };
  }
}
