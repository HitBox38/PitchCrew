import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium, type Browser, type Page } from 'playwright';
import { createServer, type ViteDevServer } from 'vite';
import { afterAll, beforeAll, expect, test } from 'vitest';

let server: ViteDevServer;
let browser: Browser;
let page: Page;
let cache: string;
const errors: string[] = [];

beforeAll(async () => {
  cache = await mkdtemp(join(tmpdir(), 'pitchcrew-design-system-cache-'));
  server = await createServer({
    root: fileURLToPath(new URL('..', import.meta.url)),
    cacheDir: cache,
    logLevel: 'error',
    server: { host: '127.0.0.1', port: 0 },
    plugins: [
      {
        name: 'standalone-design-system',
        configureServer: (vite) => {
          vite.middlewares.use('/__design-system', async (_request, response) => {
            response.setHeader('Content-Type', 'text/html');
            response.end(
              await vite.transformIndexHtml(
                '/__design-system',
                '<html><body><div id="root"></div><script type="module" src="/test/fixtures/design-system.tsx"></script></body></html>',
              ),
            );
          });
        },
      },
    ],
  });
  await server.listen();
  const address = server.httpServer!.address();
  if (!address || typeof address === 'string') throw new Error('No fixture address');
  browser = await chromium.launch({ headless: true });
  page = await browser.newPage({
    reducedMotion: 'reduce',
    viewport: { width: 1100, height: 1000 },
  });
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(`http://127.0.0.1:${address.port}/__design-system`);
  await page.getByRole('button', { name: 'Shared action' }).waitFor();
}, 60000);

afterAll(async () => {
  await browser?.close();
  await server?.close();
  if (cache) await rm(cache, { recursive: true, force: true });
});

test('package CSS supplies materials, utilities and calendar navigation without app styles', async () => {
  expect(
    await page.getByRole('button', { name: 'Shared action' }).evaluate((element) => ({
      height: getComputedStyle(element).height,
      shadow: getComputedStyle(element).boxShadow,
    })),
  ).toEqual({ height: '48px', shadow: expect.not.stringMatching(/^none$/) });
  expect(
    await page
      .getByRole('textbox', { name: 'Name' })
      .evaluate((element) => getComputedStyle(element).boxShadow),
  ).not.toBe('none');
  const next = page.getByRole('button', { name: /next month/i });
  expect(
    await next.evaluate((element) => {
      const style = getComputedStyle(element);
      return { width: style.width, align: style.alignItems, justify: style.justifyContent };
    }),
  ).toEqual({ width: '32px', align: 'center', justify: 'center' });
  await next.click();
  expect(await page.locator('.calendar-caption').textContent()).toContain('December 2026');
  expect(errors).toEqual([]);
});

test('selects and dialog lifecycles work without workspace or Motion providers in both themes', async () => {
  for (const theme of ['light', 'dark']) {
    await page
      .locator('html')
      .evaluate((element, value) => element.setAttribute('data-theme', value), theme);
    await page.getByRole('combobox', { name: 'Work mode' }).click();
    await page.getByRole('option', { name: 'Hybrid', exact: true }).click();
    expect(await page.getByRole('combobox', { name: 'Work mode' }).textContent()).toContain(
      'Hybrid',
    );
    await page.getByRole('button', { name: 'Open dialog' }).click();
    const dialog = page.getByRole('dialog', { name: 'Shared dialog' });
    await dialog.waitFor();
    await dialog.getByRole('button', { name: 'Done', exact: true }).click();
    await dialog.waitFor({ state: 'hidden' });
    expect(
      await page
        .getByRole('button', { name: 'Open dialog' })
        .evaluate((element) => element === document.activeElement),
    ).toBe(true);
  }
  expect(errors).toEqual([]);
});
