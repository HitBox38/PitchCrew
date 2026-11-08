import { it } from 'node:test';
import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { activeGuest, startDesktop, until, type DesktopE2E } from './harness.ts';
import { navigate, readyViewport } from './observe.ts';
import { siteOrigin } from './site.ts';

const capture = async (
  app: DesktopE2E,
  name: string,
  { selected = false, fresh = false }: { selected?: boolean; fresh?: boolean } = {},
) => {
  const allowed = selected
    ? await app.page.getByLabel('Native browser page', { exact: true }).boundingBox()
    : null;
  if (fresh)
    await app.page.evaluate(() => {
      const marker = document.createElement('div');
      marker.id = 'native-capture-frame';
      marker.style.cssText =
        'position:fixed;left:0;top:0;width:8px;height:8px;z-index:2147483647;background:rgb(211,17,197);pointer-events:none';
      document.body.append(marker);
    });
  try {
    const result = await app.electron.evaluate(
      async ({ BrowserWindow, nativeImage }, { allowed, fresh }) => {
        const window = BrowserWindow.getAllWindows()[0];
        const { width, height } = window.getContentBounds();
        const deadline = Date.now() + 10000;
        let bytes: Buffer;
        for (;;) {
          const image = (
            await window.webContents.capturePage(undefined, { stayHidden: true, stayAwake: true })
          ).resize({ width, height });
          bytes = image.toBitmap({ scaleFactor: 1 });
          // Windows can return the previous whole-window copy after DOM/layout settle.
          // Wait only for a new frame marker, never for the green-page assertion to pass.
          if (!fresh || (bytes[0] === 197 && bytes[1] === 17 && bytes[2] === 211)) break;
          if (Date.now() >= deadline)
            throw new Error('The hidden renderer did not paint a fresh frame');
          await new Promise((resolve) => setTimeout(resolve, 25));
        }
        let green = 0;
        let outside = 0;
        for (let offset = 0; offset < bytes.length; offset += 4) {
          if (bytes[offset] >= 90 || bytes[offset + 1] <= 210 || bytes[offset + 2] >= 60) continue;
          green++;
          const x = (offset / 4) % width;
          const y = Math.floor(offset / 4 / width);
          if (
            !allowed ||
            x < allowed.x ||
            x >= allowed.x + allowed.width ||
            y < allowed.y ||
            y >= allowed.y + allowed.height
          )
            outside++;
        }
        // Save exactly the bitmap being asserted, including on scaled Windows displays.
        return {
          green,
          outside,
          png: nativeImage
            .createFromBitmap(bytes, { width, height, scaleFactor: 1 })
            .toPNG()
            .toString('base64'),
        };
      },
      { allowed, fresh },
    );
    await writeFile(join(app.directory, `${name}.png`), Buffer.from(result.png, 'base64'));
    assert.equal(
      result.outside,
      0,
      `A native page painted outside its selected viewport (${name})`,
    );
    return result.green;
  } finally {
    if (fresh)
      await app.page.evaluate(() => document.getElementById('native-capture-frame')?.remove());
  }
};

it(
  'conceals inactive native tabs through failed navigation and panel transitions',
  { timeout: 120000 },
  async () => {
    const app = await startDesktop();
    try {
      const { page } = app;
      await page.locator('button[aria-controls="agent-browser-panel"]').click();
      await page.getByRole('button', { name: 'Open browser', exact: true }).last().click();
      await page
        .locator('.browser-state-chip:is([data-tone="browsing"], [data-tone="control"])')
        .waitFor();
      const original = await navigate(app, `${siteOrigin}/form`, 'Fictional E2E application');
      await readyViewport(app);
      await original.read(
        `document.documentElement.style.background = document.body.style.background = 'rgb(13,231,71)'`,
      );
      await page.getByRole('button', { name: 'Browser page settings', exact: true }).click();
      await page
        .getByRole('button', { name: 'Toggle browser device toolbar', exact: true })
        .press('Space');
      await page.getByRole('combobox', { name: 'Browser viewport preset', exact: true }).waitFor();
      await page.getByRole('button', { name: 'Browser page settings', exact: true }).click();
      await page
        .getByRole('combobox', { name: 'Browser viewport preset', exact: true })
        .press('Space');
      await page.getByRole('option', { name: 'iPhone SE', exact: true }).press('Enter');
      await until(
        async () =>
          (await original.read<number>('innerWidth')) === 375 &&
          (await original.read<number>('innerHeight')) === 667,
        'The actual phone viewport did not apply',
      );
      await until(
        async () => (await capture(app, 'phone-selected', { selected: true })) > 1000,
        'The selected phone page did not paint',
      );
      await page.getByRole('button', { name: 'New browser tab', exact: true }).click();
      const second = await navigate(app, `${siteOrigin}/next`, 'Fictional E2E next page');
      await page.getByRole('button', { name: 'New browser tab', exact: true }).click();
      const address = page.getByRole('textbox', { name: 'Browser address' });
      const failNavigation = async (url: string) => {
        await address.fill(url);
        const response = page.waitForResponse(
          (response) =>
            response.request().method() === 'POST' &&
            new URL(response.url()).pathname === '/api/browser/writer/input',
        );
        await page.getByRole('button', { name: 'Go to address', exact: true }).click();
        assert.equal((await response).ok(), true);
        await page.locator('.browser-page-error').waitFor();
        assert.equal(await address.inputValue(), new URL(url).href);
      };
      for (let attempt = 0; attempt < 2; attempt++) {
        await failNavigation('https://pitchcrew-browser-test.invalid');
        assert.match((await page.locator('.browser-page-error').textContent()) ?? '', /ENOTFOUND/);
        for (let frame = 0; frame < 8; frame++)
          assert.equal(
            await capture(app, `failed-${attempt}-${frame}`),
            0,
            'An inactive phone page painted over the application',
          );
      }
      // Unlike the DNS preflight above, this reaches Chromium and emits did-fail-load.
      await failNavigation(`${siteOrigin}/unavailable`);
      for (let frame = 0; frame < 8; frame++) await capture(app, `native-failed-${frame}`);
      await page.getByRole('tab', { name: 'Fictional E2E next page', exact: true }).click();
      await until(
        async () => (await activeGuest(app)).id === second.id,
        'The second tab did not return',
      );
      for (const [width, height] of [
        [1280, 900],
        [1440, 1000],
      ] as const) {
        await app.electron.evaluate(
          ({ BrowserWindow }, { width, height }) => {
            BrowserWindow.getAllWindows()[0].setContentSize(width, height);
          },
          { width, height },
        );
        await capture(app, `resized-${width}`);
      }
      await page.getByRole('button', { name: 'Expand browser', exact: true }).click();
      assert.equal(await capture(app, 'expanded'), 0);
      await page.getByRole('button', { name: 'Back to chat', exact: true }).click();
      await page.locator('button[aria-controls="agent-browser-panel"]').click();
      assert.equal(await capture(app, 'hidden'), 0);
      await page.locator('button[aria-controls="agent-browser-panel"]').click();
      await page.getByRole('tab', { name: 'Fictional E2E application', exact: true }).click();
      await until(
        async () => (await activeGuest(app)).id === original.id,
        'The original guest was replaced',
      );
      await until(
        async () =>
          (await original.read<number>('innerWidth')) === 375 &&
          (await original.read<number>('innerHeight')) === 667,
        'The original tab lost its device viewport',
      );
      await until(
        async () => (await capture(app, 'restored', { selected: true })) > 1000,
        'The selected phone page did not paint',
      );
      await page.getByRole('button', { name: 'Expand browser', exact: true }).click();
      await until(
        async () => (await capture(app, 'phone-expanded', { selected: true })) > 1000,
        'The expanded phone page did not paint',
      );
      await page.getByRole('button', { name: 'Back to chat', exact: true }).click();
      await page.locator('button[aria-controls="agent-browser-panel"]').click();
      await until(
        () =>
          page.evaluate(async () =>
            (await window.pitchcrewBrowser!.views()).every((view) => !view.bounds),
          ),
        'Hiding the browser did not withdraw guest presentation',
      );
      await page.locator('#agent-browser-panel').waitFor({ state: 'hidden' });
      await page.waitForFunction(
        () =>
          [...document.querySelectorAll('webview')].every(
            (guest) => getComputedStyle(guest).opacity === '0',
          ) && !document.querySelector('[data-browser-input-guard]'),
      );
      await capture(app, 'phone-hidden', { fresh: true });
      await page.locator('button[aria-controls="agent-browser-panel"]').click();
      await until(
        async () => (await capture(app, 'phone-restored', { selected: true })) > 1000,
        'The selected phone page did not return after hiding the panel',
      );
      assert.deepEqual(app.errors, [], 'The production renderer reported an exception');
    } catch (error) {
      console.error(error);
      throw error;
    } finally {
      await app.close();
    }
  },
);
