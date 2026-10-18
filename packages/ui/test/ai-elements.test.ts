import { fileURLToPath } from 'node:url';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { chromium, type Browser, type Page } from 'playwright';
import { createServer, type ViteDevServer } from 'vite';
import { afterAll, beforeAll, expect, test } from 'vitest';

let server: ViteDevServer;
let browser: Browser;
let page: Page;
let cache: string;
const errors: string[] = [];

beforeAll(async () => {
  // Different fixture plugins must not invalidate another server's dependency cache.
  cache = await mkdtemp(join(tmpdir(), 'pitchcrew-ai-elements-cache-'));
  server = await createServer({
    root: fileURLToPath(new URL('..', import.meta.url)),
    configFile: fileURLToPath(new URL('../vite.config.ts', import.meta.url)),
    cacheDir: cache,
    logLevel: 'error',
    server: { host: '127.0.0.1', port: 0 },
    plugins: [
      {
        name: 'ai-elements-fixture',
        configureServer(vite) {
          vite.middlewares.use('/__ai-elements', async (_request, response) => {
            response.setHeader('Content-Type', 'text/html');
            response.end(
              await vite.transformIndexHtml(
                '/__ai-elements',
                '<html><body><div id="root"></div><script type="module" src="/test/fixtures/ai-elements.tsx"></script></body></html>',
              ),
            );
          });
        },
      },
    ],
  });
  await server.listen();
  const address = server.httpServer!.address();
  if (!address || typeof address === 'string') throw new Error('No test server address');
  browser = await chromium.launch({ headless: true });
  page = await browser.newPage({
    viewport: { width: 1100, height: 1000 },
    reducedMotion: 'reduce',
  });
  page.setDefaultTimeout(10000);
  page.on('pageerror', (error) => errors.push(error.message));
  await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.goto(`http://127.0.0.1:${address.port}/__ai-elements`);
  await page.locator('[data-message-id="message-60"]').waitFor({ timeout: 30000 });
}, 60000);

afterAll(async () => {
  await browser?.close();
  await server?.close();
  if (cache) await rm(cache, { recursive: true, force: true });
});

const viewport = '[data-slot="message-scroller-viewport"]';
const atEnd = () =>
  page
    .locator(viewport)
    .evaluate(
      (element) => Math.abs(element.scrollHeight - element.scrollTop - element.clientHeight) < 3,
    );

test('shared disclosures preserve drafts and keep nested expansion independent', async () => {
  const draft = page.getByRole('button', { name: 'Review draft', exact: true });
  const evidence = page.getByRole('button', { name: 'Draft evidence', exact: true });
  const input = page.getByRole('textbox', { name: 'Saved draft', exact: true });
  expect(await draft.getAttribute('aria-expanded')).toBe('true');
  expect(await evidence.getAttribute('aria-expanded')).toBe('false');
  await input.fill('An unsaved local draft');
  await evidence.click();
  expect(await draft.getAttribute('aria-expanded')).toBe('true');
  await draft.click();
  expect(await input.isVisible()).toBe(false);
  await draft.click();
  expect(await input.inputValue()).toBe('An unsaved local draft');
  expect(await evidence.getAttribute('aria-expanded')).toBe('true');
  expect(await page.getByText('Fictional supporting evidence', { exact: true }).isVisible()).toBe(
    true,
  );
});

test('code fences preserve blank lines, copy exact text, and retain image and link safety', async () => {
  const code = page.locator('[data-slot="message-scroller-content"] [data-slot="code-block"]');
  expect(await code.count()).toBe(1);
  expect(await code.locator('code').textContent()).toBe(
    'const answer = 42;\n\nconsole.log(answer);\n',
  );
  expect(await page.locator('[data-streamdown="inline-code"]').textContent()).toBe('hello');
  expect(await page.locator('img').count()).toBe(0);
  await code.getByRole('button', { name: 'Copy', exact: true }).click();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(
    'const answer = 42;\n\nconsole.log(answer);\n',
  );
  await page.getByRole('button', { name: 'External source' }).click();
  await page.getByRole('dialog').waitFor();
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Stream code', exact: true }).click();
  await expect.poll(() => code.locator('code').textContent()).toBe('const streaming = "<safe>";\n');
  expect(await code.locator('safe').count()).toBe(0);
});

test('the scroll button restores the live edge after manually reading earlier messages', async () => {
  await page.locator(viewport).hover();
  await page.mouse.wheel(0, -5000);
  await expect.poll(atEnd).toBe(false);
  const button = page.getByRole('button', { name: 'Scroll to latest message' });
  await expect.poll(() => button.getAttribute('data-active')).toBe('true');
  await button.click();
  await expect.poll(atEnd).toBe(true);
});

test('older pages remain anchored as replies arrive and Latest restores live following', async () => {
  expect(await page.locator('[data-slot="message-scroller-item"]').count()).toBe(50);
  await page.getByRole('button', { name: 'Older', exact: true }).click();
  await page.locator('[data-message-id="message-0"]').waitFor();
  await page.waitForFunction(
    (selector) => document.querySelector(selector)!.scrollTop === 0,
    viewport,
  );
  await page.getByRole('button', { name: 'Append reply' }).click();
  expect(await page.locator('[data-message-id="message-0"]').count()).toBe(1);
  expect(await page.locator('[data-message-id="message-61"]').count()).toBe(0);
  expect(await page.locator(viewport).evaluate((element) => element.scrollTop)).toBe(0);
  await page.getByRole('button', { name: 'Latest', exact: true }).click();
  await page.locator('[data-message-id="message-61"]').waitFor();
  await expect.poll(atEnd).toBe(true);
  await page.getByRole('button', { name: 'Append reply' }).click();
  await page.locator('[data-message-id="message-62"]').waitFor();
  await expect.poll(atEnd).toBe(true);
});

test('trace disclosure works by keyboard without exposing private reasoning', async () => {
  const group = page.getByRole('button', { name: /1 step/ });
  await group.focus();
  await page.keyboard.press('Enter');
  const tool = page.getByRole('button', { name: /Read profile/ });
  await tool.waitFor();
  await tool.focus();
  await page.keyboard.press('Space');
  expect(await tool.getAttribute('aria-expanded')).toBe('true');
  expect(await page.locator('.chat-activity-step-details').first().textContent()).toContain(
    'Tool failed',
  );
  await page.getByRole('button', { name: /Thinking/ }).click();
  expect(await page.getByText('Thinking text is kept private.').isVisible()).toBe(true);
  expect(await page.locator('body').textContent()).not.toContain(
    'PRIVATE_REASONING_MUST_NEVER_RENDER',
  );
});

test('suggestions and composer retain drafts on failure, respect Shift+Enter and clear on success', async () => {
  await page.getByRole('button', { name: 'Suggested prompt' }).click();
  const input = page.getByRole('textbox', { name: 'Test message' });
  expect(await input.inputValue()).toBe('Help with my application');
  await input.press('Shift+Enter');
  expect(await input.inputValue()).toContain('\n');
  await input.dispatchEvent('compositionstart');
  const attempts = await page.getByRole('status', { name: 'Send attempts' }).textContent();
  await input.press('Enter');
  expect(await page.getByRole('status', { name: 'Send attempts' }).textContent()).toBe(attempts);
  await input.dispatchEvent('compositionend');
  await input.press('Enter');
  expect(await input.inputValue()).toContain('Help with my application');
  expect(await page.getByRole('button', { name: 'Remove resume.txt' }).count()).toBe(1);
  await page.getByRole('button', { name: 'Allow send' }).click();
  await input.press('Enter');
  await expect.poll(() => input.inputValue()).toBe('');
  expect(await page.getByRole('button', { name: 'Remove resume.txt' }).count()).toBe(0);
  expect(errors).toEqual([]);
});

test('queue disclosure preserves explicit delivery commands', async () => {
  const section = page.getByRole('region', { name: 'Queued messages' });
  // The existing semantic section is labelled but not assigned a new role.
  const queue = page.locator('section[aria-label="Queued messages"]');
  expect(await queue.getByRole('button', { name: 'Resume unfinished deliveries' }).count()).toBe(0);
  await queue.getByRole('button', { name: /1 message needs attention/ }).click();
  await queue.getByRole('button', { name: 'Resume unfinished deliveries' }).click();
  expect(await page.getByRole('status', { name: 'Queue action' }).textContent()).toBe(
    JSON.stringify({ path: '/chat-requests/request', method: 'PUT', body: { action: 'resume' } }),
  );
  expect(await section.count()).toBe(1);
  if (process.env.PITCHCREW_UI_EVIDENCE)
    await page.screenshot({ path: process.env.PITCHCREW_UI_EVIDENCE, fullPage: true });
});

test('non-chat command and action previews copy exact source without executing or rendering it', async () => {
  const source = page.getByRole('region', { name: 'Source preview examples' });
  await source.getByRole('button', { name: 'Copy Background service command' }).click();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe('pnpm service status');
  await source.getByText('Exact action details', { exact: true }).click();
  const expected = JSON.stringify(
    {
      kind: 'fill',
      selector: '#cover-letter',
      value: 'First line\n\n<script>fictional()</script> & exact text',
    },
    null,
    2,
  );
  expect(await source.locator('pre[aria-label="Action JSON"]').textContent()).toBe(expected);
  expect(await source.locator('pre script').count()).toBe(0);
  await source.getByRole('button', { name: 'Copy Action JSON' }).click();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(expected);
});

test('document source previews wrap in narrow panels and remain keyboard-scrollable', async () => {
  const source = page.locator('pre[aria-label="Profile source"]');
  const dimensions = await source.evaluate((element) => ({
    height: element.clientHeight,
    scrollHeight: element.scrollHeight,
    width: element.clientWidth,
    scrollWidth: element.scrollWidth,
    whiteSpace: getComputedStyle(element).whiteSpace,
    font: getComputedStyle(element).fontFamily,
  }));
  expect(dimensions.scrollHeight).toBeGreaterThan(dimensions.height);
  expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.width + 1);
  expect(dimensions.whiteSpace).toBe('pre-wrap');
  expect(dimensions.font).not.toContain('monospace');
  await source.focus();
  await page.keyboard.press('ArrowDown');
  await expect.poll(() => source.evaluate((element) => element.scrollTop)).toBeGreaterThan(0);
  expect(errors).toEqual([]);
});
