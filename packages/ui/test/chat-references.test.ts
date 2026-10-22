import { fileURLToPath } from 'node:url';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { chromium, type Browser, type Page } from 'playwright';
import { createServer, type ViteDevServer } from 'vite';
import { afterAll, beforeAll, expect, test } from 'vitest';
const clear = async () => {
  await input().focus();
  await page.keyboard.press('ControlOrMeta+a');
  await page.keyboard.press('Backspace');
};

let server: ViteDevServer;
let browser: Browser;
let page: Page;
let cache: string;
const errors: string[] = [];

beforeAll(async () => {
  // Different fixture plugins must not invalidate another server's dependency cache.
  cache = await mkdtemp(join(tmpdir(), 'pitchcrew-chat-references-cache-'));
  server = await createServer({
    root: fileURLToPath(new URL('..', import.meta.url)),
    configFile: fileURLToPath(new URL('../vite.config.ts', import.meta.url)),
    cacheDir: cache,
    logLevel: 'error',
    server: { host: '127.0.0.1', port: 0 },
    plugins: [
      {
        name: 'chat-references-fixture',
        configureServer: (vite) => {
          vite.middlewares.use('/__chat-references', async (_request, response) => {
            response.setHeader('Content-Type', 'text/html');
            response.end(
              await vite.transformIndexHtml(
                '/__chat-references',
                '<html><body><div id="root"></div><script type="module" src="/test/fixtures/chat-references.tsx"></script></body></html>',
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
  await page.goto(`http://127.0.0.1:${address.port}/__chat-references`);
  await page.getByRole('textbox', { name: 'Message the crew' }).waitFor({ timeout: 30000 });
}, 60000);

afterAll(async () => {
  await browser?.close();
  await server?.close();
  if (cache) await rm(cache, { recursive: true, force: true });
});

const input = () => page.getByRole('textbox', { name: 'Message the crew' });
const canonical = () => page.locator('#canonical').textContent();
test('keyboard selection creates atomic references, retains readable copy, and sends matching transcript chips', async () => {
  await input().pressSequentially('@rev');
  await page.getByRole('listbox').waitFor();
  await page.keyboard.press('Enter');
  await expect.poll(() => input().locator('[data-reference-key]').count()).toBe(1);
  expect(await page.locator('#sent').count()).toBe(0);
  await input().pressSequentially('Use $evid');
  await page.keyboard.press('Tab');
  await expect.poll(canonical).toBe('@reviewer Use $evidence-check ');
  expect(await input().locator('[data-reference-key]').count()).toBe(2);
  await page.keyboard.press('ControlOrMeta+a');
  await page.keyboard.press('ControlOrMeta+c');
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(
    '@reviewer Use $evidence-check ',
  );
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Enter');
  await expect.poll(canonical).toBe('');
  await expect.poll(() => page.locator('#sent .chat-reference').count()).toBe(2);
  await page.locator('#sent').getByRole('button', { name: 'Skill: Evidence check' }).click();
  await page.getByText('Instructions selected for this message.', { exact: false }).waitFor();
  await page.keyboard.press('Escape');
});
test('unknown suggestions never send, Escape preserves text, disabled participants stay visible, and newline/undo work', async () => {
  await clear();
  await input().pressSequentially('@unknown');
  await page.keyboard.press('Enter');
  expect(await canonical()).toBe('@unknown');
  await page.keyboard.press('Escape');
  expect(await canonical()).toBe('@unknown');
  await clear();
  await input().pressSequentially('@');
  expect(
    await page.getByRole('option', { name: 'Writer Paused' }).getAttribute('aria-disabled'),
  ).toBe('true');
  await page.keyboard.press('Enter');
  await expect.poll(() => input().locator('[data-reference-key]').count()).toBe(1);
  await page.keyboard.press('Backspace');
  await page.keyboard.press('Backspace');
  await expect.poll(() => input().locator('[data-reference-key]').count()).toBe(0);
  await page.keyboard.press('ControlOrMeta+z');
  await clear();
  await input().pressSequentially('First');
  await page.keyboard.press('Shift+Enter');
  await input().pressSequentially('Second');
  await expect.poll(canonical).toBe('First\nSecond');
});
test('slash aliases open existing context actions, skills browse without sending, and failed sends retain chips', async () => {
  await clear();
  await input().pressSequentially('/attach');
  await page.keyboard.press('Enter');
  await expect.poll(() => page.locator('#action').textContent()).toBe('attach');
  await clear();
  await input().pressSequentially('/skills');
  await page.keyboard.press('Enter');
  await expect.poll(canonical).toBe('$');
  await page.keyboard.press('Enter');
  await page.getByRole('button', { name: 'Toggle failure' }).click();
  await input().focus();
  await page.keyboard.press('Enter');
  await expect.poll(() => input().locator('[data-reference-key]').count()).toBe(1);
  expect(await canonical()).toBe('$evidence-check ');
  expect(errors).toEqual([]);
});
test('chips retain identity through clipboard paste and can be inspected and removed in the draft', async () => {
  await clear();
  await input().pressSequentially('$evi');
  await page.keyboard.press('Enter');
  await page.keyboard.press('ControlOrMeta+a');
  await page.keyboard.press('ControlOrMeta+c');
  await page.keyboard.press('Backspace');
  await page.keyboard.press('ControlOrMeta+v');
  await expect.poll(() => input().locator('[data-reference-key]').count()).toBe(1);
  expect(await canonical()).toBe('$evidence-check ');
  await input().locator('[data-reference-key]').click();
  await page.getByRole('button', { name: 'Remove from draft' }).click();
  await expect.poll(() => input().locator('[data-reference-key]').count()).toBe(0);
});
test('persisted occurrences preserve Markdown and avoid decorating literal examples, and transcript copy emits tokens', async () => {
  await page.getByRole('button', { name: 'Sample Markdown' }).click();
  await expect.poll(() => page.locator('#sent .chat-reference').count()).toBe(1);
  expect(await page.locator('#sent [data-streamdown="strong"]').textContent()).toBe('care');
  expect(await page.locator('#sent code').textContent()).toBe('$evidence-check');
  await page.locator('#sent').evaluate((element) => {
    (element as HTMLElement).tabIndex = -1;
    (element as HTMLElement).focus();
    const range = document.createRange();
    range.selectNodeContents(element);
    const selection = window.getSelection()!;
    selection.removeAllRanges();
    selection.addRange(range);
  });
  await page.keyboard.press('ControlOrMeta+c');
  expect(await page.evaluate(() => navigator.clipboard.readText())).toContain(
    'Use $evidence-check with care.',
  );
  expect(errors).toEqual([]);
});

test('agent replies render mentions and file citations during streaming and open read-only frozen previews', async () => {
  await page.getByRole('button', { name: 'Sample agent reply' }).click();
  const sent = page.locator('#sent');
  await expect.poll(() => sent.locator('.chat-reference').count()).toBe(5);
  expect(await sent.getByRole('button', { name: 'Agent: Writer', exact: true }).count()).toBe(1);
  expect(await sent.locator('code').allTextContents()).toEqual([
    '@writer',
    '[literal](pitchcrew-file:profile/profile.md)',
  ]);
  await sent.getByRole('button', { name: 'Website', exact: true }).click();
  await page.getByRole('dialog', { name: 'Open external link?' }).waitFor();
  expect(await page.getByRole('dialog', { name: 'Open external link?' }).textContent()).toContain(
    'https://example.com',
  );
  await page.keyboard.press('Escape');
  await sent.getByRole('button', { name: 'Agent: Writer', exact: true }).click();
  await page.getByText('An agent mentioned in this message.', { exact: false }).waitFor();
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Toggle streaming' }).click();
  await expect.poll(() => sent.locator('.chat-reference').count()).toBe(5);
  await page.getByRole('button', { name: 'Toggle streaming' }).click();
  await sent.getByRole('button', { name: 'File: Profile', exact: true }).click();
  await page.getByRole('dialog').waitFor();
  await page.getByRole('heading', { name: 'Current Profile' }).waitFor();
  await page.keyboard.press('Escape');
  await sent.getByRole('button', { name: 'File: saved resume', exact: true }).click();
  await page.getByRole('heading', { name: 'Saved resume' }).waitFor();
  expect(await page.getByText('Frozen experience.', { exact: true }).count()).toBe(1);
  expect(
    await page
      .getByText('Download becomes available after approving the packet', { exact: false })
      .count(),
  ).toBe(1);
  await page.keyboard.press('Escape');
  await sent.getByRole('button', { name: 'File: old file, unavailable' }).click();
  await page.getByText('This referenced file is no longer available.', { exact: true }).waitFor();
  await page.keyboard.press('Escape');
  let attachmentReads = 0;
  await page.route('**/api/chat/messages/source/attachments/cv', (route) =>
    ++attachmentReads === 1
      ? route.fulfill({ status: 404 })
      : route.fulfill({
          status: 200,
          headers: { 'Content-Disposition': "attachment; filename*=UTF-8''cv.txt" },
          body: 'Attachment evidence for preview.',
        }),
  );
  await sent.getByRole('button', { name: 'File: attached CV', exact: true }).click();
  await page.getByText('This attachment is no longer available.', { exact: true }).waitFor();
  await page.keyboard.press('Escape');
  await sent.getByRole('button', { name: 'File: attached CV', exact: true }).click();
  await page.getByText('Attachment evidence for preview.', { exact: true }).waitFor();
  await page.keyboard.press('Escape');
  await page.unroute('**/api/chat/messages/source/attachments/cv');
  await sent.evaluate((element) => {
    (element as HTMLElement).tabIndex = -1;
    (element as HTMLElement).focus();
    const range = document.createRange();
    range.selectNodeContents(element);
    const selection = window.getSelection()!;
    selection.removeAllRanges();
    selection.addRange(range);
  });
  await page.keyboard.press('ControlOrMeta+c');
  expect(await page.evaluate(() => navigator.clipboard.readText())).toContain(
    '@writer Check [Profile](pitchcrew-file:profile/profile.md)',
  );
  await page.evaluate(() => window.getSelection()?.removeAllRanges());
  expect(errors).toEqual([]);
});
