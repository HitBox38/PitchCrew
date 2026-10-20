import { fileURLToPath } from 'node:url';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { chromium, type Browser, type Page } from 'playwright';
import { createServer, type ViteDevServer } from 'vite';
import { afterAll, beforeAll, beforeEach, expect, test } from 'vitest';

let server: ViteDevServer;
let browser: Browser;
let page: Page;
let origin: string;
let cache: string;
const errors: string[] = [];
beforeAll(async () => {
  cache = await mkdtemp(join(tmpdir(), 'pitchcrew-profile-review-cache-'));
  server = await createServer({
    root: fileURLToPath(new URL('..', import.meta.url)),
    configFile: fileURLToPath(new URL('../vite.config.ts', import.meta.url)),
    cacheDir: cache,
    logLevel: 'error',
    server: { host: '127.0.0.1', port: 0 },
    plugins: [
      {
        name: 'profile-import-fixture',
        configureServer: (vite) => {
          vite.middlewares.use('/__profile-import', async (_request, response) => {
            response.setHeader('Content-Type', 'text/html');
            response.end(
              await vite.transformIndexHtml(
                '/__profile-import',
                '<html><body><div id="root"></div><script type="module" src="/test/fixtures/profile-import.tsx"></script></body></html>',
              ),
            );
          });
        },
      },
    ],
  });
  await server.listen();
  const address = server.httpServer!.address();
  if (!address || typeof address === 'string') throw new Error('No fixture server');
  origin = `http://127.0.0.1:${address.port}`;
  browser = await chromium.launch({ headless: true });
  page = await browser.newPage({ viewport: { width: 1280, height: 800 }, reducedMotion: 'reduce' });
  page.setDefaultTimeout(10000);
  page.on('pageerror', (error) => errors.push(error.message));
  await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
}, 60000);
beforeEach(async () => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto(`${origin}/__profile-import`);
  await page.getByRole('dialog', { name: 'Review profile documents' }).waitFor({ timeout: 30000 });
});
afterAll(async () => {
  await browser?.close();
  await server?.close();
  if (cache) await rm(cache, { recursive: true, force: true });
});
const search = () => page.getByRole('searchbox', { name: 'Search document changes' });
const row = (name: string) =>
  page.locator('.profile-import-document').filter({
    has: page.getByRole('checkbox', { name: `Import Experience/${name}`, exact: true }),
  });

test('shows only changes in compact rows, keeps removed copies and preserves selection across search', async () => {
  expect(await page.getByRole('checkbox').count()).toBe(25);
  expect(await page.getByRole('checkbox', { name: 'Import Experience/same.md' }).count()).toBe(0);
  expect(await page.locator('.profile-import-document').first().textContent()).toContain(
    'edited.md',
  );
  expect(
    await page.getByRole('checkbox', { name: 'Import Experience/edited.md' }).isChecked(),
  ).toBe(false);
  const height = await row('updated.md').evaluate(
    (element) => element.getBoundingClientRect().height,
  );
  expect(height).toBeLessThanOrEqual(52);
  await search().fill('RETIRED');
  expect(await page.getByText('Local copy kept').isVisible()).toBe(true);
  expect(await page.getByRole('checkbox').count()).toBe(0);
  await search().fill('does-not-exist');
  expect(await page.getByText('No matching changes', { exact: true }).isVisible()).toBe(true);
  await search().fill('updated');
  await page.getByRole('checkbox', { name: 'Import Experience/updated.md' }).uncheck();
  await search().fill('added');
  await page.getByRole('button', { name: 'Import 23 documents', exact: true }).click();
  const selected = JSON.parse((await page.getByLabel('Imported names').textContent())!) as string[];
  expect(selected).toContain('added.md');
  expect(selected).not.toContain('updated.md');
  expect(selected).not.toContain('same.md');
  expect(selected).not.toContain('edited.md');
  expect(selected).not.toContain('retired.md');
});

test('keyboard accordion exposes saved-to-incoming word changes, exact source copying and conflict warnings', async () => {
  const trigger = row('updated.md').getByRole('button', {
    name: 'Experience/updated.md Changed',
    exact: true,
  });
  await trigger.focus();
  await page.keyboard.press('Enter');
  expect(await trigger.getAttribute('aria-expanded')).toBe('true');
  expect(await row('updated.md').locator('del').allTextContents()).toContain('three');
  expect(await row('updated.md').locator('ins').allTextContents()).toContain('eight');
  expect(await page.evaluate(() => 'injection' in window)).toBe(false);
  await row('updated.md').getByRole('button', { name: 'Full document', exact: true }).click();
  await row('updated.md').getByRole('button', { name: 'Copy Experience/updated.md' }).click();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toContain(
    '<script>window.injection = true</script>',
  );
  await page.getByRole('checkbox', { name: 'Import Experience/edited.md' }).check();
  expect(
    await page.getByText(/Importing replaces local edits in 1 selected document/).isVisible(),
  ).toBe(true);
  await page.getByRole('button', { name: 'Select without local edits' }).click();
  expect(
    await page.getByRole('checkbox', { name: 'Import Experience/edited.md' }).isChecked(),
  ).toBe(false);
  expect(await page.getByRole('checkbox').count()).toBe(25);
});

test('phone layout keeps search and actions visible while only the list scrolls', async () => {
  await page.setViewportSize({ width: 390, height: 700 });
  const layout = await page.locator('.profile-import-panel').evaluate((sheet) => {
    const list = sheet.querySelector('.profile-import-review')!;
    const footer = sheet.querySelector('.profile-import-footer')!;
    return {
      width: sheet.getBoundingClientRect().width,
      overflow: sheet.scrollWidth > sheet.clientWidth,
      scrolls: list.scrollHeight > list.clientHeight,
      footer: footer.getBoundingClientRect().bottom,
    };
  });
  expect(layout.width).toBeLessThanOrEqual(390);
  expect(layout.overflow).toBe(false);
  expect(layout.scrolls).toBe(true);
  expect(layout.footer).toBeLessThanOrEqual(700);
  await page.locator('.profile-import-review').evaluate((element) => {
    element.scrollTop = element.scrollHeight;
  });
  expect(await search().isVisible()).toBe(true);
  expect(
    await page.getByRole('button', { name: 'Import 24 documents', exact: true }).isVisible(),
  ).toBe(true);
});

test('removed-only and unchanged reviews have no importable documents, and busy review cannot close', async () => {
  for (const mode of ['removed', 'unchanged']) {
    await page.goto(`${origin}/__profile-import?mode=${mode}`);
    const button = page.getByRole('button', { name: 'Import 0 documents', exact: true });
    await button.waitFor();
    expect(await button.isDisabled()).toBe(true);
    expect(await page.getByRole('checkbox').count()).toBe(0);
    expect(
      await page
        .getByText(mode === 'removed' ? 'Local copy kept' : 'Everything is up to date')
        .isVisible(),
    ).toBe(true);
  }
  await page.goto(`${origin}/__profile-import?mode=busy`);
  await page.getByRole('button', { name: 'Importing…', exact: true }).waitFor();
  expect(await page.getByRole('button', { name: 'Importing…', exact: true }).isDisabled()).toBe(
    true,
  );
  await page.getByRole('button', { name: 'Close dialog' }).click();
  await page.keyboard.press('Escape');
  expect(await page.getByRole('dialog').isVisible()).toBe(true);
  expect(errors).toEqual([]);
});
