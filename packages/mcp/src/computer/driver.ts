import { chromium, type Browser, type Page } from 'playwright';
import { hash } from './helpers.ts';
import { assertPublicUrl } from './network.ts';
import type { BrowserDriver } from './types.ts';

export async function launchBrowser(): Promise<BrowserDriver> {
  let browser: Browser;
  try {
    browser = await chromium.launch({ headless: false, chromiumSandbox: true });
  } catch {
    throw new Error(
      'Install the local browser with: pnpm --filter @pitchcrew/mcp exec playwright install chromium',
    );
  }
  try {
    return await createBrowserDriver(browser);
  } catch (error) {
    await browser.close();
    throw error;
  }
}
export async function createBrowserDriver(browser: Browser): Promise<BrowserDriver> {
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    acceptDownloads: false,
    serviceWorkers: 'block',
  });
  await context.route('**/*', async (route) => {
    try {
      await assertPublicUrl(route.request().url());
      await route.continue();
    } catch {
      await route.abort('blockedbyclient');
    }
  });
  await context.routeWebSocket('**/*', (socket) => socket.close());
  let page: Page = await context.newPage();
  context.on('page', (popup) => {
    page = popup;
  });
  context.on('dialog', (dialog) => {
    void dialog.dismiss();
  });
  page.setDefaultTimeout(10000);
  return {
    async snapshot() {
      const current = page;
      const state = await current.evaluate(() => ({
        html: document.documentElement.outerHTML,
        fields: Array.from(document.querySelectorAll('input,textarea,select')).map((element) => {
          const field = element as HTMLInputElement;
          return {
            tag: field.tagName,
            id: field.id,
            name: field.name,
            type: field.type,
            value: field.value,
            checked: field.checked,
          };
        }),
      }));
      const url = current.url();
      const text =
        `${await current.locator('body').ariaSnapshot()}\nForm controls (use CSS selectors by id or name):\n${JSON.stringify(state.fields.map((field) => (field.type === 'password' ? { ...field, value: '[hidden]' } : field)))}`.slice(
          0,
          30000,
        );
      const screenshot = (await current.screenshot({ type: 'jpeg', quality: 40 })).toString(
        'base64',
      );
      return { url, title: await current.title(), text, screenshot, digest: hash({ url, state }) };
    },
    async perform(action, file) {
      if (action.kind === 'navigate') {
        await assertPublicUrl(action.url);
        await page.goto(action.url, { waitUntil: 'domcontentloaded', timeout: 20000 });
        return;
      }
      const target = page.locator(action.selector);
      if ((await target.count()) !== 1)
        throw new Error('Choose a selector matching exactly one element.');
      if (action.kind === 'click') await target.click({ timeout: 10000 });
      if (action.kind === 'fill') {
        if ((await target.getAttribute('type'))?.toLowerCase() === 'password')
          throw new Error(
            'Sign in manually in the dedicated browser; do not give passwords to agents.',
          );
        await target.fill(action.value, { timeout: 10000 });
      }
      if (action.kind === 'select') await target.selectOption(action.value, { timeout: 10000 });
      if (action.kind === 'press') await target.press(action.key, { timeout: 10000 });
      if (action.kind === 'upload' && file)
        await target.setInputFiles(
          { name: file.name, mimeType: 'text/markdown', buffer: file.buffer },
          { timeout: 10000 },
        );
    },
    close: () => browser.close(),
  };
}
