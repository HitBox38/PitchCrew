import { browserViewportSchema, type BrowserSnapshot } from '@pitchcrew/core';
import { chromium, type Browser, type BrowserContext, type Page, type Dialog } from 'playwright';
import { inspectControls } from './inspection.ts';
import { hash } from './helpers.ts';
import { assertPublicUrl } from './network.ts';
import type { BrowserDriver } from './types.ts';
import { automaticFormAction } from './form-policy.ts';
import { preparationGuard } from './preparation.ts';
import { mkdir } from 'node:fs/promises';
import { credentialSelector } from './credentials.ts';

export async function launchBrowser(profile?: string): Promise<BrowserDriver> {
  try {
    if (profile) {
      await mkdir(profile, { recursive: true, mode: 0o700 });
      const context = await chromium.launchPersistentContext(profile, {
        headless: true,
        chromiumSandbox: true,
        viewport: { width: 1280, height: 800 },
        acceptDownloads: false,
        serviceWorkers: 'block',
      });
      try {
        return await contextDriver(context, () => context.close());
      } catch (error) {
        await context.close();
        throw error;
      }
    }
    const browser = await chromium.launch({ headless: true, chromiumSandbox: true });
    try {
      return await createBrowserDriver(browser);
    } catch (error) {
      await browser.close();
      throw error;
    }
  } catch {
    throw new Error(
      'Could not open the local browser. Install Chromium with pnpm browser:install.',
    );
  }
}
export async function createBrowserDriver(browser: Browser): Promise<BrowserDriver> {
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    acceptDownloads: false,
    serviceWorkers: 'block',
  });
  return contextDriver(context, () => browser.close());
}
async function contextDriver(
  context: BrowserContext,
  close: () => Promise<void>,
): Promise<BrowserDriver> {
  const guard = preparationGuard();
  let viewport = { width: 1280, height: 800 };
  let rendering = Promise.resolve();
  const render = <T>(operation: () => Promise<T>) => {
    const result = rendering.then(operation);
    rendering = result.then(
      () => {},
      () => {},
    );
    return result;
  };
  const sizePage = async (current: Page) => {
    const size = current.viewportSize();
    if (size?.width !== viewport.width || size?.height !== viewport.height)
      await current.setViewportSize(viewport);
  };
  await context.route('**/*', async (route) => {
    try {
      if (guard.rejects(route.request())) {
        await route.abort('blockedbyclient');
        return;
      }
      await assertPublicUrl(route.request().url());
      await route.fallback();
    } catch {
      await route.abort('blockedbyclient');
    }
  });
  await context.routeWebSocket('**/*', (socket) => socket.close());
  for (const restored of context.pages()) await restored.close();
  let page: Page = await context.newPage();
  await guard.attach(page);
  context.on('page', (popup) => {
    page = popup;
    previous = undefined;
    popup.setDefaultTimeout(10000);
    popup.on('close', () => {
      if (page !== popup) return;
      page =
        context
          .pages()
          .filter((tab) => !tab.isClosed())
          .at(-1) ?? popup;
      previous = undefined;
      pendingDialog = undefined;
    });
    void guard.attach(popup).catch(() => {});
  });
  let pendingDialog: Dialog | undefined;
  let previous: BrowserSnapshot | undefined;
  context.on('dialog', (dialog) => {
    pendingDialog = dialog;
  });
  page.setDefaultTimeout(10000);
  return {
    prepare: guard.prepare,
    invalidate() {
      previous = undefined;
    },
    resize: (requested) =>
      render(async () => {
        const next = browserViewportSchema.parse(requested);
        if (pendingDialog) return false;
        if (next.width === viewport.width && next.height === viewport.height) return true;
        await Promise.all(context.pages().map((tab) => tab.setViewportSize(next)));
        viewport = next;
        previous = undefined;
        return true;
      }),
    frame: () =>
      render(async () => {
        const current = page;
        await sizePage(current);
        return {
          screenshot: (
            await current.screenshot({ type: 'jpeg', quality: 60, timeout: 5000 })
          ).toString('base64'),
          ...current.viewportSize()!,
          url: current.url(),
          title: pendingDialog ? (previous?.title ?? '') : await current.title(),
          ...(guard.blocked
            ? {
                warning:
                  'This site needs supervised requests. Further preparation actions will ask for approval.',
              }
            : {}),
          ...(pendingDialog
            ? { dialog: { type: pendingDialog.type(), message: pendingDialog.message() } }
            : {}),
        };
      }),
    freshPage: () =>
      render(async () => {
        const old = context.pages();
        page = await context.newPage();
        await guard.attach(page);
        await sizePage(page);
        pendingDialog = undefined;
        previous = undefined;
        guard.reset();
        for (const tab of old) await tab.close();
        page.setDefaultTimeout(10000);
      }),
    automatic: async (action) => !guard.blocked && (await automaticFormAction(page, action)),
    async input(input) {
      if (input.kind === 'dialog') {
        if (!pendingDialog) throw new Error('No browser dialog is pending.');
        const dialog = pendingDialog;
        pendingDialog = undefined;
        if (input.decision === 'accept') await dialog.accept(input.text);
        else await dialog.dismiss();
        return;
      }
      if (pendingDialog) throw new Error('Resolve the browser dialog first.');
      if (input.kind === 'navigate') {
        await assertPublicUrl(input.url);
        await page.goto(input.url, { waitUntil: 'domcontentloaded', timeout: 20000 });
      }
      if (input.kind === 'click') {
        const size = page.viewportSize()!;
        if (
          input.viewport &&
          (input.viewport.width !== size.width || input.viewport.height !== size.height)
        )
          throw new Error('The browser resized. Wait for the updated page and click again.');
        if (input.x > size.width || input.y > size.height)
          throw new Error('Click is outside the current browser viewport.');
        await page.mouse.click(input.x, input.y);
      }
      if (input.kind === 'scroll') await page.mouse.wheel(input.deltaX, input.deltaY);
      if (input.kind === 'text') await page.keyboard.insertText(input.text);
      if (input.kind === 'key') await page.keyboard.press(input.key);
    },
    snapshot: () =>
      render(async () => {
        if (pendingDialog) {
          const dialog = { type: pendingDialog.type(), message: pendingDialog.message() };
          const base =
            previous?.url === page.url()
              ? previous
              : {
                  url: page.url(),
                  title: '',
                  text: '',
                  screenshot: '',
                  digest: hash({ url: page.url() }),
                };
          return {
            ...base,
            text: `${base.text}\nBrowser dialog: ${dialog.type}: ${dialog.message}`,
            dialog,
            digest: hash({ page: base.digest, dialog }),
          };
        }
        const current = page;
        await sizePage(current);
        const snapshotViewport = current.viewportSize()!;
        const state = await current.evaluate(
          (credentials) => ({
            html: document.documentElement.outerHTML,
            fields: Array.from(document.querySelectorAll('input,textarea,select')).map(
              (element) => {
                const field = element as HTMLInputElement;
                return {
                  tag: field.tagName,
                  id: field.id,
                  name: field.name,
                  type: field.matches(credentials) ? 'password' : field.type,
                  value: field.value,
                  checked: field.checked,
                };
              },
            ),
          }),
          credentialSelector,
        );
        const evidence = await inspectControls(current);
        const url = current.url();
        const text =
          `${evidence.text}\nForm controls (use CSS selectors by id or name):\n${JSON.stringify(state.fields.map((field) => (field.type === 'password' ? { ...field, value: '[hidden]' } : field)))}`.slice(
            0,
            30000,
          );
        const screenshot = (
          await current.screenshot({
            type: 'jpeg',
            quality: 40,
            mask: current.frames().map((frame) => frame.locator(credentialSelector)),
          })
        ).toString('base64');
        previous = {
          viewport: snapshotViewport,
          url,
          title: await current.title(),
          text: guard.blocked
            ? `${text}\nPreparation blocked a website request. Do not claim the upload or autosave succeeded. Request the exact action again; it will require user approval.`
            : text,
          screenshot,
          controls: evidence.controls,
          uninspected: evidence.uninspected,
          digest: hash({ url, state, frames: evidence.frames, viewport: snapshotViewport }),
        };
        return previous;
      }),
    async validate(action) {
      if (action.kind === 'navigate') return;
      if (action.kind === 'dialog') {
        if (!pendingDialog) throw new Error('No browser dialog is pending.');
        return;
      }
      if (action.frame && (await page.locator(action.frame).count()) !== 1)
        throw new Error('Choose a frame selector matching exactly one frame.');
      const target = action.frame
        ? page.frameLocator(action.frame).locator(action.selector)
        : page.locator(action.selector);
      if ((await target.count()) !== 1)
        throw new Error('Choose a selector matching exactly one element.');
    },
    async perform(action, file, automatic = false) {
      guard.prepare(automatic);
      if (action.kind === 'dialog') {
        if (!pendingDialog) throw new Error('No browser dialog is pending.');
        if (pendingDialog.type() === 'prompt' && action.decision === 'accept')
          throw new Error('Handle browser prompts manually; agents cannot enter credentials.');
        const dialog = pendingDialog;
        pendingDialog = undefined;
        if (action.decision === 'accept') await dialog.accept();
        else await dialog.dismiss();
        return;
      }
      if (pendingDialog)
        throw new Error(
          'Resolve the browser dialog with exact approval or manually before other interactions.',
        );
      if (action.kind === 'navigate') {
        await assertPublicUrl(action.url);
        guard.navigate(true);
        try {
          await page.goto(action.url, { waitUntil: 'domcontentloaded', timeout: 20000 });
        } finally {
          guard.navigate(false);
        }
        return;
      }
      const target = action.frame
        ? page.frameLocator(action.frame).locator(action.selector)
        : page.locator(action.selector);
      if ((await target.count()) !== 1)
        throw new Error('Choose a selector matching exactly one element.');
      if (automatic)
        guard.protect(
          await page
            .locator('form')
            .evaluateAll((forms) => forms.map((form) => (form as HTMLFormElement).action)),
        );
      if (action.kind === 'click') await target.click({ timeout: 10000 });
      if (action.kind === 'fill') {
        if (
          await target.evaluate(
            (element, credentials) => element.matches(credentials),
            credentialSelector,
          )
        )
          throw new Error(
            'Sign in manually in the dedicated browser; do not give passwords to agents.',
          );
        await target.fill(action.value, { timeout: 10000 });
      }
      if (action.kind === 'select') await target.selectOption(action.value, { timeout: 10000 });
      if (action.kind === 'press') await target.press(action.key, { timeout: 10000 });
      if (action.kind === 'upload' && file)
        await target.setInputFiles(
          { name: file.name, mimeType: file.mimeType ?? 'text/markdown', buffer: file.buffer },
          { timeout: 10000 },
        );
    },
    close,
  };
}
