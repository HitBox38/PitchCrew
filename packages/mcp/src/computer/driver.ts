import { browserViewportSchema, type BrowserSnapshot } from '@pitchcrew/core';
import type { Browser, BrowserContext, Page, Dialog } from 'playwright';
import { inspectControls } from './inspection.ts';
import { hash } from './helpers.ts';
import { assertPublicUrl } from './network.ts';
import type { BrowserDriver } from './types.ts';
import { automaticFormAction } from './form-policy.ts';
import { preparationGuard } from './preparation.ts';
import { mkdir } from 'node:fs/promises';
import { credentialSelector } from './credentials.ts';
import { captureManualField, validateApplicationFields } from './application-fields.ts';
import { browserFrameStream } from './frame-stream.ts';

export const launchBrowser = async (profile?: string): Promise<BrowserDriver> => {
  try {
    const { chromium } = await import('playwright');
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
        for (const page of context.pages()) await page.close();
        return await sharedContextDriver(context, () => context.close());
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
};
export const createBrowserDriver = async (browser: Browser): Promise<BrowserDriver> => {
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    acceptDownloads: false,
    serviceWorkers: 'block',
  });
  return sharedContextDriver(context, () => browser.close());
};

const sessionPage = async (context: BrowserContext) => {
  creatingPages.set(context, (creatingPages.get(context) ?? 0) + 1);
  try {
    return await context.newPage();
  } finally {
    creatingPages.set(context, (creatingPages.get(context) ?? 1) - 1);
  }
};

const sharedContextDriver = async (
  context: BrowserContext,
  closeContext: () => Promise<void>,
): Promise<BrowserDriver> => {
  let users = 0;
  const open = async (): Promise<BrowserDriver> => {
    users++;
    browserUsers.set(context, users);
    let closed = false;
    try {
      const driver = await contextDriver(context, async () => {
        if (closed) return;
        closed = true;
        browserUsers.set(context, --users);
        if (users === 0) await closeContext();
      });
      return { ...driver, newTab: open };
    } catch (error) {
      browserUsers.set(context, --users);
      if (users === 0) await closeContext();
      throw error;
    }
  };
  return open();
};
const contextDriver = async (
  context: BrowserContext,
  close: () => Promise<void>,
): Promise<BrowserDriver> => {
  const guard = preparationGuard();
  const manualFields = new Set<string>();
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
  let policies = browserPolicies.get(context);
  if (!policies) {
    policies = new Map();
    browserPolicies.set(context, policies);
    const registry = policies;
    await context.route('**/*', async (route) => {
      try {
        const requested = route.request().frame().page();
        const policy = registry.get(requested) ?? registry.get((await requested.opener())!);
        if (!policy || policy.rejects(route.request())) {
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
  }
  const owned = new Set<Page>();
  let page: Page = await sessionPage(context);
  let pendingDialog: Dialog | undefined;
  let previous: BrowserSnapshot | undefined;
  const captureFrame = () =>
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
        ...frameMetadata(),
      };
    });
  const frameMetadata = () => ({
    ...(guard.blocked
      ? {
          warning:
            'This site needs supervised requests. Further preparation actions will ask for approval.',
        }
      : {}),
    ...(pendingDialog
      ? { dialog: { type: pendingDialog.type(), message: pendingDialog.message() } }
      : {}),
  });
  const frames = browserFrameStream({
    page: () => page,
    metadata: () => ({ ...viewport, url: page.url(), title: '', ...frameMetadata() }),
    capture: captureFrame,
    screencast: process.env.PITCHCREW_BROWSER_SCREENCAST !== '0',
  });
  const attach = async (current: Page) => {
    owned.add(current);
    policies.set(current, guard);
    await guard.attach(current);
    current.setDefaultTimeout(10000);
    current.on('dialog', (dialog) => {
      pendingDialog = dialog;
      frames.refresh();
    });
    current.on('framenavigated', (frame) => {
      if (current === page && frame === current.mainFrame()) frames.reset();
    });
    current.on('crash', () => {
      if (current === page) frames.reset();
    });
    current.on('close', () => {
      owned.delete(current);
      policies.delete(current);
      if (page === current) {
        page = [...owned].filter((tab) => !tab.isClosed()).at(-1) ?? current;
        previous = undefined;
        pendingDialog = undefined;
        frames.reset();
      }
    });
  };
  const onPage = (popup: Page) => {
    if ((creatingPages.get(context) ?? 0) > 0) return;
    void (async () => {
      const opener = await popup.opener();
      if (opener ? !owned.has(opener) : browserUsers.get(context) !== 1) return;
      page = popup;
      previous = undefined;
      frames.reset();
      await attach(popup);
      await sizePage(popup);
      frames.reset();
    })().catch(() => {});
  };
  context.on('page', onPage);
  await attach(page);
  page.setDefaultTimeout(10000);
  return {
    validateApplicationValues: (values, action) =>
      validateApplicationFields(page, action, values, manualFields),
    prepare: guard.prepare,
    invalidate: () => {
      previous = undefined;
      frames.reset();
    },
    resize: (requested) =>
      render(async () => {
        const next = browserViewportSchema.parse(requested);
        if (pendingDialog) return false;
        if (next.width === viewport.width && next.height === viewport.height) return true;
        await Promise.all([...owned].map((tab) => tab.setViewportSize(next)));
        viewport = next;
        previous = undefined;
        frames.reset();
        return true;
      }),
    frame: captureFrame,
    subscribeFrames: frames.subscribe,
    freshPage: () =>
      render(async () => {
        const old = [...owned];
        manualFields.clear();
        page = await sessionPage(context);
        frames.reset();
        await attach(page);
        await sizePage(page);
        pendingDialog = undefined;
        previous = undefined;
        guard.reset();
        frames.reset();
        for (const tab of old) await tab.close();
        page.setDefaultTimeout(10000);
      }),
    automatic: async (action) => !guard.blocked && (await automaticFormAction(page, action)),
    input: async (input) => {
      const before = new Set<string>();
      if (input.kind === 'key') await captureManualField(page, before);
      if (input.kind === 'dialog') {
        if (!pendingDialog) throw new Error('No browser dialog is pending.');
        const dialog = pendingDialog;
        pendingDialog = undefined;
        frames.refresh();
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
        if (input.generation !== undefined && input.generation !== frames.generation)
          throw new Error('The browser page changed. Wait for the updated page and click again.');
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
      if (input.kind === 'text') await captureManualField(page, manualFields);
      if (
        input.kind === 'key' &&
        ['Backspace', 'Delete', 'Space', 'Enter', 'ArrowDown', 'ArrowUp'].includes(input.key)
      ) {
        const after = new Set<string>();
        await captureManualField(page, after);
        for (const value of after) if (!before.has(value)) manualFields.add(value);
      }
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
    validate: async (action) => {
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
    perform: async (action, file, automatic = false) => {
      guard.prepare(automatic);
      if (action.kind === 'dialog') {
        if (!pendingDialog) throw new Error('No browser dialog is pending.');
        if (pendingDialog.type() === 'prompt' && action.decision === 'accept')
          throw new Error('Handle browser prompts manually; agents cannot enter credentials.');
        const dialog = pendingDialog;
        pendingDialog = undefined;
        frames.refresh();
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
    close: async () => {
      context.off('page', onPage);
      await frames.close();
      for (const tab of [...owned]) await tab.close();
      await close();
    },
  };
};

const browserUsers = new WeakMap<BrowserContext, number>();
const creatingPages = new WeakMap<BrowserContext, number>();
const browserPolicies = new WeakMap<
  BrowserContext,
  Map<Page, ReturnType<typeof preparationGuard>>
>();
