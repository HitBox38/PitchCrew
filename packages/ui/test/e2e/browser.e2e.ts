import { after, afterEach, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { activeGuest, startDesktop, until, type DesktopE2E } from './harness.ts';
import { siteOrigin } from './site.ts';
import {
  guestPoint,
  assertLiveGuest,
  navigate,
  readyApproval,
  readyViewport,
  send,
} from './observe.ts';
import type { Request } from 'playwright';

describe('Production UI → daemon → Electron browser E2E', { concurrency: false }, () => {
  let app: DesktopE2E;
  before(
    async () => {
      app = await startDesktop();
    },
    { timeout: 60000 },
  );
  after(
    async () => {
      await app?.close();
    },
    { timeout: 25000 },
  );
  afterEach(async () => {
    if (!app) return;
    const sheet = app.page.locator('.notification-panel:not([data-ending-style])');
    if (await sheet.isVisible())
      await sheet.getByRole('button', { name: 'Close', exact: true }).click();
    const reset = app.page.getByRole('dialog', {
      name: 'Reset this agent’s browser?',
      exact: true,
    });
    if (await reset.isVisible())
      await reset.getByRole('button', { name: 'Cancel', exact: true }).click();
    if (
      await app.page
        .locator(
          '[data-slot="popover-content"]:not([data-ending-style]), [data-slot="context-menu-content"]:not([data-ending-style])',
        )
        .first()
        .isVisible()
    )
      await app.page.keyboard.press('Escape');
  });
  it(
    'opens a real isolated guest from Chat and navigates through the actual address control',
    { timeout: 45000 },
    async () => {
      const { page } = app;
      await page.locator('button[aria-controls="agent-browser-panel"]').click();
      await page.getByRole('button', { name: 'Open browser', exact: true }).last().click();
      await page.getByRole('button', { name: 'Return to agent', exact: true }).waitFor();
      await page.getByRole('textbox', { name: 'Browser address' }).fill(`${siteOrigin}/form`);
      await page.getByRole('button', { name: 'Go to address', exact: true }).click();
      const guest = await until(async () => {
        const guest = await activeGuest(app);
        return (await guest.read<string>('document.title')) === 'Fictional E2E application'
          ? guest
          : null;
      }, 'The address control never navigated the actual native guest');
      assert.equal(await guest.read('location.href'), `${siteOrigin}/form`);
      await readyViewport(app);
      await assertLiveGuest(app);
      assert.equal(await page.locator('.browser-screen').count(), 0);
      assert.equal(
        await page.evaluate(() => typeof window.pitchcrewBrowser?.registerView),
        'function',
      );
    },
  );
  it('routes trusted human pointer and keyboard input into that guest after UI takeover', async () => {
    const guest = await activeGuest(app);
    const point = await guestPoint(app, '#name');
    await app.page.mouse.click(point.x, point.y);
    await app.page.keyboard.type('Human E2E');
    await until(
      async () => (await guest.read('document.querySelector("#name").value')) === 'Human E2E',
      'Trusted human typing never reached the actual input',
    );
    assert.equal(await guest.read('window.lastInputTrusted'), true);
  });
  it('keeps a live native page and the same guest beneath a real application popover', async () => {
    const guest = await activeGuest(app);
    const before = await guest.read<number>(
      'Number(document.querySelector("#pulse").getAnimations()[0].currentTime)',
    );
    const initialScale = await guest.read<number>('devicePixelRatio');
    await app.page.getByRole('button', { name: 'Browser page settings', exact: true }).click();
    await app.page.getByRole('button', { name: 'Zoom in', exact: true }).waitFor();
    await assertLiveGuest(app, app.page.locator('[data-slot="popover-content"]'));
    await until(
      async () =>
        (await guest.read<number>(
          'Number(document.querySelector("#pulse").getAnimations()[0].currentTime)',
        )) >
        before + 2,
      'The native page froze beneath its popover',
    );
    assert.equal((await activeGuest(app)).id, guest.id);
    await app.page.getByRole('button', { name: 'Zoom in', exact: true }).click();
    await until(
      async () =>
        Math.abs((await guest.read<number>('devicePixelRatio')) - initialScale * 1.25) < 0.05,
      'Page zoom did not reach the actual guest',
    );
    await app.page.keyboard.press('Escape');
    await app.page.getByRole('button', { name: 'Browser page settings', exact: true }).click();
    await app.page.getByRole('button', { name: 'Reset page zoom', exact: true }).click();
    await app.page.keyboard.press('Escape');
  });
  it(
    'keeps the guest live beneath real context menus, a confirmation dialog and a sheet',
    { timeout: 30000 },
    async () => {
      for (let count = 0; count < 7; count++)
        await app.page
          .getByRole('separator', { name: 'Resize browser panel', exact: true })
          .press('ArrowLeft');
      await app.page.locator('.browser-panel-heading').click({ button: 'right' });
      const menu = app.page.getByRole('menu', { name: 'Workspace actions', exact: true });
      await menu.waitFor();
      await assertLiveGuest(app, menu);
      await app.page.keyboard.press('Escape');
      await app.page.getByRole('button', { name: 'Browser options', exact: true }).click();
      await app.page.getByRole('menuitem', { name: 'Reset saved sign-ins…', exact: true }).click();
      const dialog = app.page.getByRole('dialog', {
        name: 'Reset this agent’s browser?',
        exact: true,
      });
      await dialog.waitFor();
      await assertLiveGuest(app, dialog);
      await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
      await dialog.waitFor({ state: 'hidden' });
      await app.page.locator('.notification-bell').click();
      const sheet = app.page.locator('.notification-panel');
      await sheet.waitFor();
      await assertLiveGuest(app, sheet);
      await sheet.getByRole('button', { name: 'Close', exact: true }).click();
      await sheet.waitFor({ state: 'hidden' });
    },
  );
  it('expands and restores the actual Base UI browser surface without replacing or disabling its guest', async () => {
    const guest = await activeGuest(app);
    await app.page.getByRole('button', { name: 'Expand browser', exact: true }).click();
    await app.page.getByRole('button', { name: 'Restore split view', exact: true }).waitFor();
    await app.page.getByRole('button', { name: 'Browser page settings', exact: true }).click();
    await assertLiveGuest(app, app.page.locator('[data-slot="popover-content"]'));
    await app.page.keyboard.press('Escape');
    const point = await guestPoint(app, '#continue');
    await app.page.mouse.click(point.x, point.y);
    await until(
      async () =>
        (await guest.read('document.querySelector("#result").textContent')) ===
        'Continued by trusted input: true',
      'Expanded browser did not receive a trusted human click',
    );
    await app.page.getByRole('button', { name: 'Restore split view', exact: true }).click();
    assert.equal(
      (
        await until(
          () => activeGuest(app),
          'Browser guest did not return after restoring split view',
        )
      ).id,
      guest.id,
    );
  });
  it('retains the same page, human draft and manual lease across actual route navigation', async () => {
    const guest = await activeGuest(app);
    await app.page.getByRole('link', { name: 'Settings', exact: true }).click();
    await app.page.getByRole('heading', { name: 'Settings', exact: true }).waitFor();
    await app.page.locator('a[href="/chat/writer"]').first().click();
    await app.page.getByRole('button', { name: 'Return to agent', exact: true }).waitFor();
    assert.equal(
      (await until(() => activeGuest(app), 'Browser guest did not return after route navigation'))
        .id,
      guest.id,
    );
    assert.equal(await guest.read('document.querySelector("#name").value'), 'Human E2E');
    assert.equal(
      await app.page.getByRole('button', { name: 'Reload page', exact: true }).isEnabled(),
      true,
    );
  });
  it('opens and navigates a second tab, uses actual history and restores the original human draft', async () => {
    const original = await activeGuest(app);
    await app.page.getByRole('button', { name: 'New browser tab', exact: true }).click();
    const second = await navigate(app, `${siteOrigin}/form`, 'Fictional E2E application');
    assert.notEqual(second.id, original.id);
    await navigate(app, `${siteOrigin}/next`, 'Fictional E2E next page');
    await app.page.getByRole('button', { name: 'Back', exact: true }).click();
    await until(
      async () => (await second.read('location.pathname')) === '/form',
      'UI Back did not reach the prior document',
    );
    await app.page.getByRole('button', { name: 'Forward', exact: true }).click();
    await until(
      async () => (await second.read('location.pathname')) === '/next',
      'UI Forward did not reach the next document',
    );
    await app.page.getByRole('button', { name: 'Fictional E2E application', exact: true }).click();
    await until(
      async () => (await activeGuest(app)).id === original.id,
      'UI tab selection did not restore the original guest',
    );
    assert.equal(await original.read('document.querySelector("#name").value'), 'Human E2E');
    await app.page
      .getByRole('button', { name: 'Close Fictional E2E next page', exact: true })
      .click();
    await until(
      async () =>
        await app.electron.evaluate(({ webContents }, id) => !webContents.fromId(id), second.id),
      'UI tab close retained its native WebContents',
    );
    assert.equal((await activeGuest(app)).id, original.id);
  });
  it('captures the real native page, annotates it and attaches a PNG only to the existing message draft', async () => {
    const sent: string[] = [];
    const observe = (request: Request) => {
      if (
        request.method() === 'POST' &&
        request.url().endsWith('/api/conversations/writer/messages')
      )
        sent.push(request.url());
    };
    app.page.on('request', observe);
    try {
      const composer = app.page.getByRole('textbox', { name: 'Message Writer', exact: true });
      await composer.fill('Screenshot feedback draft');
      await app.page
        .getByRole('button', { name: 'Capture browser screenshot', exact: true })
        .click();
      const dialog = app.page.getByRole('dialog', { name: 'Browser screenshot', exact: true });
      await dialog.waitFor();
      const canvas = dialog.getByLabel('Annotate browser screenshot', { exact: true });
      await until(
        async () =>
          canvas.evaluate((node) => {
            const canvas = node as HTMLCanvasElement;
            return (
              canvas.width > 240 &&
              canvas.height > 160 &&
              canvas.getContext('2d')!.getImageData(10, 10, 1, 1).data[3] === 255
            );
          }),
        'The screenshot editor did not decode a real native PNG',
      );
      await dialog
        .getByRole('textbox', { name: 'Screenshot note', exact: true })
        .fill('Real Electron E2E feedback');
      await dialog.getByRole('button', { name: 'Attach to message', exact: true }).click();
      await dialog.waitFor({ state: 'hidden' });
      const files = app.page.getByRole('list', { name: 'Files to attach', exact: true });
      await files.waitFor();
      assert.match(await files.innerText(), /\.png/);
      assert.equal(await composer.innerText(), 'Screenshot feedback draft');
      assert.deepEqual(sent, [], 'Screenshot attachment sent a chat message without the user');
      await files.getByRole('button', { name: /^Remove / }).click();
      await composer.fill('');
    } finally {
      app.page.off('request', observe);
    }
  });
  it(
    'runs a real scoped MCP action only after an exact decision in the production UI',
    { timeout: 45000 },
    async () => {
      const guest = await activeGuest(app);
      await app.page.getByRole('button', { name: 'Return to agent', exact: true }).click();
      await send(app, 'E2E: fill the application');
      const pending = await readyApproval(app);
      assert.equal(
        await guest.read('document.querySelector("#name").value'),
        'Human E2E',
        'The agent filled a field before approval',
      );
      assert.equal(
        await app.page.getByRole('button', { name: 'Take control', exact: true }).isVisible(),
        true,
      );
      const result = await guest.read('document.querySelector("#result").textContent');
      const point = await guestPoint(app, '#continue');
      await app.page.mouse.click(point.x, point.y);
      assert.equal(
        await guest.read('document.querySelector("#result").textContent'),
        result,
        'Read-only viewing allowed a human click without takeover',
      );
      await pending.getByRole('button', { name: 'Approve interaction', exact: true }).click();
      await until(
        async () => (await guest.read('document.querySelector("#name").value')) === 'Agent E2E',
        'Approved MCP action never reached the actual guest',
      );
      await app.page
        .getByText('I completed the approved E2E browser action.', { exact: true })
        .waitFor();
    },
  );
  it(
    'rejects a real agent action without dispatching its native click',
    { timeout: 45000 },
    async () => {
      const guest = await activeGuest(app);
      const before = await guest.read('document.querySelector("#result").textContent');
      await send(app, 'E2E: click Continue');
      const pending = await readyApproval(app);
      await pending.getByRole('button', { name: 'Reject', exact: true }).click();
      await app.page
        .getByText('I did not perform the rejected E2E action.', { exact: true })
        .waitFor();
      assert.equal(await guest.read('document.querySelector("#result").textContent'), before);
    },
  );
  it(
    'recovers an actual crashed guest through Retry page with a fresh generation',
    { timeout: 30000 },
    async () => {
      await app.page.getByRole('button', { name: 'Take control', exact: true }).click();
      await app.page.getByRole('button', { name: 'Return to agent', exact: true }).waitFor();
      const crashed = await activeGuest(app);
      const url = await crashed.read<string>('location.href');
      await app.electron.evaluate(
        ({ webContents }, id) => webContents.fromId(id)!.forcefullyCrashRenderer(),
        crashed.id,
      );
      await app.page.getByRole('button', { name: 'Retry page', exact: true }).waitFor();
      await app.page.getByRole('button', { name: 'Retry page', exact: true }).click();
      const recovered = await until(async () => {
        const next = await activeGuest(app);
        return next.id !== crashed.id &&
          (await next.read('location.href')) === url &&
          (await next.read('document.title')) === 'Fictional E2E application'
          ? next
          : undefined;
      }, 'Retry did not create and navigate a fresh native guest');
      assert.notEqual(recovered.id, crashed.id);
      assert.equal(
        await app.electron.evaluate(({ webContents }, id) => !!webContents.fromId(id), crashed.id),
        false,
      );
      await readyViewport(app);
      await assertLiveGuest(app);
    },
  );
  it('closes the browser through the actual UI and destroys its owned guests', async () => {
    await app.page.getByRole('button', { name: 'Browser options', exact: true }).click();
    await app.page
      .getByRole('menuitem', { name: /^(Stop run and close browser|Close browser)$/ })
      .click();
    await app.page.getByRole('button', { name: 'Open browser', exact: true }).last().waitFor();
    await until(
      async () =>
        (await app.electron.evaluate(
          ({ webContents }) =>
            webContents.getAllWebContents().filter((contents) => contents.getType() === 'webview')
              .length,
        )) === 0,
      'UI close retained an owned native guest',
    );
    assert.deepEqual(app.errors, [], 'The production renderer reported runtime exceptions');
  });
});
