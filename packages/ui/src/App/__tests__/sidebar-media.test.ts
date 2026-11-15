import { afterAll, beforeAll, expect, it } from 'vitest';
import { chromium, type Browser } from 'playwright';
import { createServer, type ViteDevServer } from 'vite';
import { createRequire } from 'node:module';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { sidebarMediaFixture } from './sidebar-media-fixture.ts';

let server: ViteDevServer, browser: Browser, cache: string, url: string;
beforeAll(async () => {
  const root = fileURLToPath(new URL('../../..', import.meta.url));
  const design = createRequire(join(root, '../design-system/package.json'));
  cache = await mkdtemp(join(tmpdir(), 'pitchcrew-sidebar-media-'));
  server = await createServer({
    root,
    configFile: false,
    cacheDir: cache,
    resolve: {
      alias: Object.fromEntries(
        ['class-variance-authority', 'clsx', 'tailwind-merge'].map((name) => [
          name,
          design.resolve(name),
        ]),
      ),
    },
    optimizeDeps: { entries: [], include: ['react', 'react-dom/client'] },
    server: { host: '127.0.0.1', port: 0 },
    plugins: [
      {
        name: 'sidebar-media-fixture',
        resolveId: (id) =>
          id === '/sidebar-media-fixture' ? '\0sidebar-media-fixture' : undefined,
        load: (id) => (id === '\0sidebar-media-fixture' ? sidebarMediaFixture : undefined),
        configureServer(vite) {
          vite.middlewares.use(async (req, res, next) => {
            if (req.url?.split('?')[0] !== '/sidebar-media') return next();
            res.setHeader('Content-Type', 'text/html');
            res.end(
              await vite.transformIndexHtml(
                '/sidebar-media',
                '<!doctype html><html><head><link rel="icon" href="data:,"></head><body><div id="root"></div><script type="module" src="/sidebar-media-fixture"></script></body></html>',
              ),
            );
          });
        },
      },
    ],
  });
  await server.listen();
  const address = server.httpServer!.address();
  if (!address || typeof address === 'string') throw new Error('No sidebar fixture port.');
  url = `http://127.0.0.1:${address.port}/sidebar-media`;
  browser = await chromium.launch();
  // The first visit compiles the fixture's modules; do it here rather than inside a test's budget.
  const warm = await browser.newPage();
  await warm.goto(url);
  await warm.locator('#state').waitFor({ timeout: 90000 });
  await warm.close();
}, 120000);

afterAll(async () => {
  await browser?.close();
  await server?.close();
  if (cache) {
    if (!resolve(cache).startsWith(resolve(tmpdir()) + sep))
      throw new Error('Invalid fixture cache.');
    await rm(cache, { recursive: true, force: true });
  }
});

it('defaults short coarse chat to a rail while temporary toggles preserve the normal preference', async () => {
  const context = await browser.newContext({
    viewport: { width: 844, height: 390 },
    hasTouch: true,
  });
  try {
    const page = await context.newPage();
    await page.goto(url);
    await expect.poll(() => page.locator('#state').getAttribute('data-open')).toBe('false');
    expect(await page.locator('#state').getAttribute('data-mobile')).toBe('false');
    expect(await page.locator('#state').getAttribute('data-rail')).toBe('true');
    await page.getByRole('button', { name: 'Toggle navigation' }).click();
    await expect.poll(() => page.locator('#state').getAttribute('data-open')).toBe('true');
    expect(await page.evaluate(() => document.cookie)).toBe('');
    await page.getByRole('button', { name: 'Board', exact: true }).click();
    await expect.poll(() => page.locator('#state').getAttribute('data-rail')).toBe('false');
    expect(await page.locator('#state').getAttribute('data-open')).toBe('true');
    await page.getByRole('button', { name: 'Chat', exact: true }).click();
    await expect.poll(() => page.locator('#state').getAttribute('data-open')).toBe('false');
    await page.setViewportSize({ width: 844, height: 900 });
    await expect.poll(() => page.locator('#state').getAttribute('data-open')).toBe('true');
    expect(await page.evaluate(() => document.cookie)).toBe('');
  } finally {
    await context.close();
  }
});

it.each([false, true])(
  'restores the controlled normal preference %s after leaving rail mode',
  async (open) => {
    const context = await browser.newContext({
      viewport: { width: 844, height: 900 },
      hasTouch: true,
    });
    try {
      const page = await context.newPage();
      await page.goto(`${url}?controlled&open=${open}`);
      await expect.poll(() => page.locator('#state').getAttribute('data-open')).toBe(String(open));
      await page.setViewportSize({ width: 844, height: 390 });
      await expect.poll(() => page.locator('#state').getAttribute('data-rail')).toBe('true');
      expect(await page.locator('#state').getAttribute('data-open')).toBe('false');
      await page.getByRole('button', { name: 'Toggle navigation' }).click();
      await expect.poll(() => page.locator('#state').getAttribute('data-open')).toBe('true');
      expect(await page.locator('#normal-preference').innerText()).toBe(String(open));
      expect(await page.evaluate(() => document.cookie)).toBe('');
      await page.setViewportSize({ width: 844, height: 900 });
      await expect.poll(() => page.locator('#state').getAttribute('data-rail')).toBe('false');
      expect(await page.locator('#state').getAttribute('data-open')).toBe(String(open));
      await page.getByRole('button', { name: 'Toggle navigation' }).click();
      await expect.poll(() => page.locator('#normal-preference').innerText()).toBe(String(!open));
      expect(await page.evaluate(() => document.cookie)).toBe(`sidebar_state=${!open}`);
    } finally {
      await context.close();
    }
  },
);

it('retains the desktop preference on fine pointers and the existing phone drawer breakpoint', async () => {
  const fine = await browser.newContext({ viewport: { width: 844, height: 390 } });
  const phone = await browser.newContext({ viewport: { width: 390, height: 568 }, hasTouch: true });
  try {
    const desktop = await fine.newPage();
    await desktop.goto(url);
    await expect.poll(() => desktop.locator('#state').getAttribute('data-open')).toBe('true');
    expect(await desktop.locator('#state').getAttribute('data-rail')).toBe('false');
    const mobile = await phone.newPage();
    await mobile.goto(url);
    await expect.poll(() => mobile.locator('#state').getAttribute('data-mobile')).toBe('true');
    expect(await mobile.locator('#state').getAttribute('data-drawer')).toBe('false');
    await mobile.getByRole('button', { name: 'Toggle navigation' }).click();
    await expect.poll(() => mobile.locator('#state').getAttribute('data-drawer')).toBe('true');
    expect(await mobile.evaluate(() => document.cookie)).toBe('');
  } finally {
    await fine.close();
    await phone.close();
  }
});
