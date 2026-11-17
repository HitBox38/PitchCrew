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
        configureServer: (vite) => {
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
  await page.goto(`http://127.0.0.1:${address.port}/__ai-elements`, { timeout: 30000 });
  await page.locator('[data-message-id="message-60"]').waitFor({ timeout: 30000 });
}, 60000);

afterAll(async () => {
  await browser?.close();
  await server?.close();
  if (cache) await rm(cache, { recursive: true, force: true });
});

const viewport = '[data-slot="message-scroller-viewport"]';
const clipboardText = async () => {
  const text = await page.evaluate(() => navigator.clipboard.readText());
  // Windows stores clipboard line endings as CRLF; keep every other byte significant.
  return process.platform === 'win32' ? text.replace(/\r\n/g, '\n') : text;
};
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
  expect(await clipboardText()).toBe('const answer = 42;\n\nconsole.log(answer);\n');
  await page.getByRole('button', { name: 'External source' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.waitFor();
  await dialog.getByRole('button', { name: 'Copy link', exact: true }).click();
  expect(await clipboardText()).toBe('https://example.com/source');
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'External source' }).click();
  const popupReady = page.waitForEvent('popup');
  await page
    .context()
    .route('https://example.com/source', (route) =>
      route.fulfill({ contentType: 'text/html', body: '<p>Fictional external source</p>' }),
    );
  await dialog.getByRole('button', { name: 'Open link', exact: true }).click();
  const popup = await popupReady;
  await popup.waitForLoadState();
  expect(popup.url()).toBe('https://example.com/source');
  expect(await popup.locator('body').textContent()).toBe('Fictional external source');
  await popup.close();
  await dialog.waitFor({ state: 'detached' });
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

test('a failed step says why before it is expanded, and long targets stay on one line', async () => {
  const reasonText =
    'Exit code 1: ActivityStep.tsx has 104 lines; components may have at most 100.';
  const failed = page.getByRole('button', { name: /Command failed/ });
  const reason = page.locator('.chat-activity-step-reason');
  expect(await failed.getAttribute('aria-expanded')).toBe('false');
  expect(await reason.isVisible()).toBe(true);
  expect(await reason.textContent()).toBe(reasonText);
  expect(await reason.getAttribute('title')).toBe(reasonText);
  expect(await reason.getAttribute('role')).toBeNull();
  // The reason describes the button from outside it, so the button's name stays the step.
  expect(await failed.getAttribute('aria-describedby')).toBe(await reason.getAttribute('id'));
  expect(await failed.textContent()).not.toContain(reasonText);
  const detail = page.locator('.chat-activity-step-detail').filter({ hasText: 'vitest run' });
  expect(await detail.getAttribute('title')).toBe(
    'bun x --no-install vitest run packages/ui/src/ChatTurn packages/ui/src/Analytics packages/ui/src/AgentBrowser/__tests__/layout.test.ts --project unit-and-api',
  );
  const size = await detail.evaluate((element) => ({
    height: element.getBoundingClientRect().height,
    scrollWidth: element.scrollWidth,
    width: element.clientWidth,
  }));
  expect(size.scrollWidth).toBeGreaterThan(size.width);
  expect(size.height).toBeLessThanOrEqual(18);
  const clamp = () =>
    reason.evaluate((element) => getComputedStyle(element).getPropertyValue('-webkit-line-clamp'));
  expect(await clamp()).toBe('2');
  await failed.focus();
  await page.keyboard.press('Enter');
  expect(await failed.getAttribute('aria-expanded')).toBe('true');
  const details = page
    .locator('.chat-activity-step')
    .filter({ has: failed })
    .locator('.chat-activity-step-details');
  const copy = details.getByRole('button', { name: 'Copy reason', exact: true });
  await copy.waitFor();
  // The same line shows the whole reason in place while the step is open, so nothing below it
  // jumps against the opening details, and the details never repeat it.
  expect(await reason.isVisible()).toBe(true);
  expect(await clamp()).toBe('none');
  expect(await details.textContent()).not.toContain(reasonText);
  await copy.click();
  expect(await clipboardText()).toBe(reasonText);
  await failed.focus();
  await page.keyboard.press('Space');
  expect(await failed.getAttribute('aria-expanded')).toBe('false');
  expect(await reason.isVisible()).toBe(true);
  expect(await clamp()).toBe('2');
  expect(await page.locator('body').textContent()).not.toContain(
    'PRIVATE_REASONING_MUST_NEVER_RENDER',
  );
});

test('targets read in the app face unless they are a runtime’s literal input', async () => {
  const font = (text: string) =>
    page
      .locator('.chat-activity-step-detail')
      .filter({ hasText: text })
      .evaluate((element) => ({
        family: getComputedStyle(element).fontFamily,
        direction: getComputedStyle(element).direction,
      }));
  // A runtime's own command line is literal input.
  expect((await font('bun run lint')).family).toContain('monospace');
  // A crew step reuses the search kind for words; this one also keeps its right-to-left start.
  const words = await font('ציפיות שכר');
  expect(words.family).toContain('Source Sans 3');
  expect(words.family).not.toContain('monospace');
  expect(words.direction).toBe('rtl');
});

test('queue disclosure preserves explicit delivery commands', async () => {
  const queue = page
    .getByRole('region', { name: 'Queued messages', exact: true })
    .and(page.locator('.chat-queue'));
  const disclosure = queue.getByRole('button', { name: /^1 not sent/ });
  const resume = queue.getByRole('button', { name: 'Resume message', exact: true });
  expect(await disclosure.getAttribute('aria-expanded')).toBe('false');
  expect(await resume.isVisible()).toBe(true);
  await disclosure.click();
  expect(await disclosure.getAttribute('aria-expanded')).toBe('true');
  await resume.click();
  await expect
    .poll(() => page.getByRole('status', { name: 'Queue action' }).textContent())
    .toBe(
      JSON.stringify({ path: '/chat-requests/request', method: 'PUT', body: { action: 'resume' } }),
    );
  expect(await queue.count()).toBe(1);
  if (process.env.PITCHCREW_UI_EVIDENCE)
    await page.screenshot({ path: process.env.PITCHCREW_UI_EVIDENCE, fullPage: true });
});

test('non-chat command and action previews copy exact source without executing or rendering it', async () => {
  const source = page.getByRole('region', { name: 'Source preview examples' });
  await source.getByRole('button', { name: 'Copy Background service command' }).click();
  expect(await clipboardText()).toBe('bun run service status');
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
  expect(await clipboardText()).toBe(expected);
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

test('blocked link confirmation shows a reason without opening the target', async () => {
  await page.getByRole('button', { name: 'Preview blocked link', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Open external link?', exact: true });
  await dialog.getByRole('button', { name: 'Open link', exact: true }).click();
  await dialog.waitFor({ state: 'detached' });
  const toast = page.locator('[data-slot="toast"]').filter({ hasText: 'Link blocked:' });
  await toast.waitFor();
  expect(await toast.textContent()).toContain('Pitchcrew opens only HTTP and HTTPS websites');
  expect(await page.getByRole('status', { name: 'Unsafe link opened' }).textContent()).toBe(
    'false',
  );
  await toast.locator('[data-slot="toast-close"]').click();
  await toast.waitFor({ state: 'detached' });
});

test('unsafe anchor clicks explain invalid URLs, credentials and protocols', async () => {
  const current = page.url();
  for (const [url, message] of [
    ['https://', 'this is not a valid website address'],
    [
      'https://fixture-user:fixture-password@example.com/private',
      'it contains a username or password',
    ],
    ['file:///pitchcrew-fictional-blocked-link', 'Pitchcrew opens only HTTP and HTTPS websites'],
  ]) {
    const prevented = await page.evaluate((href) => {
      const link = document.createElement('a');
      link.href = href;
      link.target = '_blank';
      document.body.append(link);
      const allowed = link.dispatchEvent(
        new MouseEvent('click', { bubbles: true, cancelable: true, composed: true }),
      );
      link.remove();
      return !allowed;
    }, url);
    expect(prevented).toBe(true);
    const toast = page.locator('[data-slot="toast"]').filter({ hasText: message });
    await toast.waitFor();
    expect(await toast.textContent()).not.toContain('fixture-password');
    expect(await toast.textContent()).not.toContain('fixture-user');
    expect(page.url()).toBe(current);
    await toast.locator('[data-slot="toast-close"]').click();
    await toast.waitFor({ state: 'detached' });
  }
});

test('local blob document downloads still work with the link guard mounted', async () => {
  const downloadReady = page.waitForEvent('download');
  await page.evaluate(() => {
    const link = document.createElement('a');
    link.href = URL.createObjectURL(new Blob(['Fictional exported document']));
    link.download = 'fixture.txt';
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(link.href), 1000);
  });
  const download = await downloadReady;
  expect(download.suggestedFilename()).toBe('fixture.txt');
  expect(await download.failure()).toBeNull();
  expect(await page.locator('[data-slot="toast"]').count()).toBe(0);
});
