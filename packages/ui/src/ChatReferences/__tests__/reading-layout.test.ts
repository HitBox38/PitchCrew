import { afterAll, beforeAll, expect, it } from 'vitest';
import { chromium, type Browser, type Page } from 'playwright';
import { createServer, type ViteDevServer } from 'vite';
import { fileURLToPath } from 'node:url';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

let server: ViteDevServer, browser: Browser, page: Page, cache: string;
beforeAll(async () => {
  const root = fileURLToPath(new URL('../../..', import.meta.url));
  cache = await mkdtemp(join(tmpdir(), 'pitchcrew-reading-'));
  server = await createServer({
    root,
    configFile: join(root, 'vite.config.ts'),
    cacheDir: cache,
    logLevel: 'error',
    server: { host: '127.0.0.1', port: 0 },
    plugins: [
      {
        name: 'reading-fixture',
        configureServer(vite) {
          vite.middlewares.use('/__reading', async (_request, response) => {
            response.setHeader('Content-Type', 'text/html');
            response.end(
              await vite.transformIndexHtml(
                '/__reading',
                '<html data-interface="clay"><body><div id="root"></div><script type="module" src="/src/ChatReferences/__tests__/reading-fixture.tsx"></script></body></html>',
              ),
            );
          });
        },
      },
    ],
  });
  await server.listen();
  const address = server.httpServer!.address();
  if (!address || typeof address === 'string') throw new Error('No reading fixture address');
  browser = await chromium.launch();
  page = await browser.newPage();
  await page.goto(`http://127.0.0.1:${address.port}/__reading`);
  await page.locator('ol').waitFor();
  await page.evaluate(() => document.fonts.ready);
}, 60000);
afterAll(async () => {
  await browser?.close();
  await server?.close();
  if (cache) await rm(cache, { recursive: true, force: true });
});

it.each([1440, 390, 320])(
  'hangs wrapped and nested lists, including two-digit markers, at %spx',
  async (width) => {
    await page.setViewportSize({ width, height: 900 });
    const lists = await page.locator('ul, ol').evaluateAll((elements) =>
      elements.map((list) => {
        const item = list.querySelector('li')!;
        const byLine = new Map<number, number>();
        const walker = document.createTreeWalker(item, NodeFilter.SHOW_TEXT);
        for (let node = walker.nextNode(); node; node = walker.nextNode()) {
          if (node.parentElement?.closest('li') !== item) continue;
          const range = document.createRange();
          range.selectNodeContents(node);
          for (const rect of range.getClientRects())
            if (rect.width > 1 && rect.height > 8) {
              const line = Math.round(rect.top);
              byLine.set(line, Math.min(byLine.get(line) ?? Infinity, rect.left));
            }
        }
        return {
          position: getComputedStyle(list).listStylePosition,
          start: list.getAttribute('start'),
          lines: [...byLine.values()],
        };
      }),
    );
    expect(lists.find((list) => list.start === '10')).toBeTruthy();
    for (const list of lists.slice(0, 3)) {
      expect(list.position).toBe('outside');
      expect(list.lines.length).toBeGreaterThan(1);
      expect(Math.max(...list.lines) - Math.min(...list.lines)).toBeLessThanOrEqual(1);
    }
    expect(await page.getByRole('checkbox', { name: 'Completed item' }).count()).toBe(1);
  },
);

it('keeps reference popover text twelve pixels inside its surface', async () => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: 'Agent: Career Coach', exact: true }).click();
  const details = page.locator('.chat-reference-details');
  const padding = await details.evaluate((element) => {
    const style = getComputedStyle(element);
    return [style.paddingTop, style.paddingRight, style.paddingBottom, style.paddingLeft];
  });
  expect(padding).toEqual(['12px', '12px', '12px', '12px']);
  expect(await page.getByRole('button', { name: 'Agent settings', exact: true }).isVisible()).toBe(
    true,
  );
  await page.keyboard.press('Escape');
});
