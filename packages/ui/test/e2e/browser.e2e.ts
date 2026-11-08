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
import { checkExpandedEscape } from './escape.ts';

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
      // Opening is browsing: control is taken implicitly and the chip says so.
      await page
        .locator('.browser-state-chip:is([data-tone="browsing"], [data-tone="control"])')
        .waitFor();
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
  it(
    'returns from native static content on Escape after website fields, handlers, menus and dialogs',
    { timeout: 45000 },
    async () => checkExpandedEscape(app),
  );
  it('keeps a live native page and the same guest beneath a real application popover', async () => {
    // Exercise the modal sheet used on narrow Windows CI desktops.
    await app.page.getByRole('button', { name: 'Expand browser', exact: true }).click();
    try {
      await readyViewport(app);
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
      await until(
        async () => Math.abs((await guest.read<number>('devicePixelRatio')) - initialScale) < 0.05,
        'Reset page zoom did not reach the actual guest',
      );
      await app.page.keyboard.press('Escape');
      await app.page.getByRole('button', { name: 'Browser page settings', exact: true }).waitFor();
      await app.page.getByRole('button', { name: 'Back to chat', exact: true }).waitFor();
      assert.equal((await activeGuest(app)).id, guest.id);
    } finally {
      const back = app.page.getByRole('button', { name: 'Back to chat', exact: true });
      if (await back.isVisible()) await back.click();
    }
  });
  it(
    'keeps the guest live beneath real context menus, a confirmation dialog and a sheet',
    { timeout: 30000 },
    async () => {
      for (let count = 0; count < 7; count++)
        await app.page
          .getByRole('separator', { name: 'Resize browser panel', exact: true })
          .press('ArrowLeft');
      // Let the resized page settle first: its late viewport change would otherwise close
      // the menu while it is being checked.
      await readyViewport(app);
      // The header's empty edge: tabs in its middle open their own Tab actions menu.
      await app.page
        .locator('.browser-panel-heading')
        .click({ button: 'right', position: { x: 14, y: 40 } });
      const menu = app.page.getByRole('menu', { name: 'Workspace actions', exact: true });
      await menu.waitFor();
      await assertLiveGuest(app, menu);
      await app.page.keyboard.press('Escape');
      // The exiting context menu restores focus on unmount. Let it finish before opening
      // another menu, otherwise that restoration can dismiss Browser options on macOS.
      await app.page.locator('[data-slot="context-menu-content"]').waitFor({ state: 'detached' });
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
    await app.page.getByRole('button', { name: 'Back to chat', exact: true }).waitFor();
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
    await app.page.getByRole('button', { name: 'Back to chat', exact: true }).click();
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
    await app.page
      .locator('.browser-state-chip:is([data-tone="browsing"], [data-tone="control"])')
      .waitFor();
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
    // The guest navigates before its new title reaches the React tab strip.
    await app.page.getByRole('tab', { name: 'Fictional E2E next page', exact: true }).waitFor();
    await app.page.getByRole('tab', { name: 'Fictional E2E application', exact: true }).click();
    await until(
      async () => (await activeGuest(app)).id === original.id,
      'UI tab selection did not restore the original guest',
    );
    assert.equal(await original.read('document.querySelector("#name").value'), 'Human E2E');
    // An inactive tab shows its close button on hover, as a person reaches for it.
    await app.page.getByRole('tab', { name: 'Fictional E2E next page', exact: true }).hover();
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
      // Page tools live in Browser page settings.
      await app.page.getByRole('button', { name: 'Browser page settings', exact: true }).click();
      await app.page
        .locator('.browser-settings-tools')
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
      const settings = app.page.getByRole('button', { name: 'Browser page settings', exact: true });
      if ((await settings.getAttribute('aria-expanded')) === 'true')
        await app.page.keyboard.press('Escape');
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
  it('picks a real page element through inspect mode without pressing it', async () => {
    const guest = await activeGuest(app);
    const before = await guest.read('document.querySelector("#result").textContent');
    await app.page.getByRole('button', { name: 'Pick an element to attach', exact: true }).click();
    // Inspect mode starts after control and focus settle; the tray says so just before it.
    await app.page
      .locator('.browser-approvals')
      .getByText('Click an element on the page to attach it.', { exact: false })
      .waitFor();
    assert.equal(
      await app.page
        .getByRole('button', { name: 'Cancel picking (Esc)', exact: true })
        .getAttribute('aria-pressed'),
      'true',
    );
    await new Promise((resolve) => setTimeout(resolve, 1000));
    const point = await guestPoint(app, '#continue');
    await app.page.mouse.move(point.x, point.y, { steps: 4 });
    await app.page.mouse.click(point.x, point.y);
    const dialog = app.page.getByRole('dialog', { name: 'Picked element', exact: true });
    await dialog.waitFor();
    assert.match(await dialog.innerText(), /Button “Continue”/);
    assert.equal(
      await app.page.locator('.browser-settings-menu').count(),
      0,
      'Page settings stayed open over the page while picking',
    );
    // Escape reaches the review once it has taken focus back from the page.
    await until(
      () => dialog.evaluate((element) => element.contains(document.activeElement)),
      'The picked-element review never took focus from the page',
    );
    assert.equal(
      await guest.read('document.querySelector("#result").textContent'),
      before,
      'Picking pressed the element instead of selecting it',
    );
    const cropAt100 = await dialog
      .locator('canvas')
      .evaluate((canvas: HTMLCanvasElement) => [canvas.width, canvas.height]);
    await app.page.keyboard.press('Escape');
    await dialog.waitFor({ state: 'hidden' });
    const settings = app.page.getByRole('button', { name: 'Browser page settings', exact: true });
    if ((await settings.getAttribute('aria-expanded')) === 'true')
      await app.page.keyboard.press('Escape');
    // At 125% page zoom the crop is the same element, scaled: CSS-pixel boxes become DIP clips.
    const zoom = (factor: number) =>
      app.electron.evaluate(
        ({ webContents }, [id, value]) => webContents.fromId(id)?.setZoomFactor(value),
        [guest.id, factor] as const,
      );
    await zoom(1.25);
    await new Promise((resolve) => setTimeout(resolve, 500));
    await app.page.getByRole('button', { name: 'Pick an element to attach', exact: true }).click();
    await app.page
      .locator('.browser-approvals')
      .getByText('Click an element on the page to attach it.', { exact: false })
      .waitFor();
    await new Promise((resolve) => setTimeout(resolve, 1000));
    const zoomed = await guestPoint(app, '#continue');
    await app.page.mouse.move(zoomed.x, zoomed.y, { steps: 4 });
    await app.page.mouse.click(zoomed.x, zoomed.y);
    await dialog.waitFor();
    assert.match(await dialog.innerText(), /Button “Continue”/);
    const cropAt125 = await dialog
      .locator('canvas')
      .evaluate((canvas: HTMLCanvasElement) => [canvas.width, canvas.height]);
    for (const axis of [0, 1])
      assert.ok(
        Math.abs(cropAt125[axis]! / cropAt100[axis]! - 1.25) < 0.08,
        `The 125% crop was ${cropAt125.join('×')} against ${cropAt100.join('×')} at 100%`,
      );
    await until(
      () => dialog.evaluate((element) => element.contains(document.activeElement)),
      'The zoomed picked-element review never took focus from the page',
    );
    await app.page.keyboard.press('Escape');
    await dialog.waitFor({ state: 'hidden' });
    if ((await settings.getAttribute('aria-expanded')) === 'true')
      await app.page.keyboard.press('Escape');
    await zoom(1);
  });
  it(
    'runs a real scoped MCP action only after an exact decision in the production UI',
    { timeout: 45000 },
    async () => {
      const guest = await activeGuest(app);
      // Control taken by browsing hands back on its own when the agent's run starts.
      await send(app, 'E2E: fill the application');
      const pending = await readyApproval(app);
      assert.equal(
        await guest.read('document.querySelector("#name").value'),
        'Human E2E',
        'The agent filled a field before approval',
      );
      assert.equal(
        await app.page
          .locator('.browser-approvals')
          .getByRole('button', { name: 'Take over', exact: true })
          .isVisible(),
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
      await pending.getByRole('button', { name: 'Approve typing', exact: true }).click();
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
    'recovers an actual crashed guest through Reload page with a fresh generation',
    { timeout: 30000 },
    async () => {
      // The agent is idle again: explicit control comes from Browser options.
      await app.page.locator('.browser-state-chip[data-tone="idle"]').waitFor();
      await app.page.getByRole('button', { name: 'Browser options', exact: true }).click();
      await app.page
        .getByRole('menuitem', { name: 'Keep control until I return it', exact: true })
        .click();
      await app.page
        .locator('.browser-approvals')
        .getByRole('button', { name: 'Return to agent', exact: true })
        .waitFor();
      const crashed = await activeGuest(app);
      const url = await crashed.read<string>('location.href');
      await app.electron.evaluate(
        ({ webContents }, id) => webContents.fromId(id)!.forcefullyCrashRenderer(),
        crashed.id,
      );
      const reload = app.page
        .locator('.browser-page-error')
        .getByRole('button', { name: 'Reload page', exact: true });
      await reload.waitFor();
      await reload.click();
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

describe('Failed navigation in the production Electron browser', { concurrency: false }, () => {
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
  it('retains failed navigation across tab switching and retry, then recovers through the address field', async () => {
    const { page } = app;
    await page.locator('button[aria-controls="agent-browser-panel"]').click();
    await page.getByRole('button', { name: 'Open browser', exact: true }).last().click();
    await page
      .locator('.browser-state-chip:is([data-tone="browsing"], [data-tone="control"])')
      .waitFor();
    await navigate(app, `${siteOrigin}/form`, 'Fictional E2E application');
    await readyViewport(app);
    const firstGuest = (await activeGuest(app)).id;
    await page.getByRole('button', { name: 'New browser tab', exact: true }).click();
    try {
      await page.getByRole('heading', { name: 'New tab', exact: true }).waitFor();
      const address = page.getByRole('textbox', { name: 'Browser address' });
      const failedUrl = 'https://pitchcrew-browser-test.invalid/';
      await address.fill(failedUrl);
      await address.press('Enter');
      const error = page.locator('.browser-page-error');
      await error.waitFor();
      assert.equal(await address.inputValue(), failedUrl);
      assert.equal(await page.getByRole('heading', { name: 'New tab', exact: true }).count(), 0);
      assert.match((await error.textContent()) ?? '', /ENOTFOUND pitchcrew-browser-test.invalid/);
      await page.screenshot({ path: `${app.directory}/failed-navigation.png` });
      await page.locator('.browser-tab-select').nth(0).click();
      await error.waitFor({ state: 'hidden' });
      assert.equal(await address.inputValue(), `${siteOrigin}/form`);
      await page.locator('.browser-tab-select').nth(1).click();
      await error.waitFor();
      assert.equal(await address.inputValue(), failedUrl);
      const retried = page.waitForResponse(
        (response) =>
          response.request().method() === 'POST' &&
          response.url().includes('/native?') &&
          response.request().postDataJSON()?.command?.kind === 'reload',
      );
      await error.getByRole('button', { name: 'Retry page', exact: true }).click();
      assert.equal((await retried).ok(), true);
      assert.equal(await address.inputValue(), failedUrl);
      assert.match((await error.textContent()) ?? '', /ENOTFOUND pitchcrew-browser-test.invalid/);
      await address.fill(`${siteOrigin}/next`);
      await address.press('Enter');
      await error.waitFor({ state: 'hidden' });
      await until(
        async () => (await (await activeGuest(app)).read('location.href')) === `${siteOrigin}/next`,
        'The recovered tab did not load its replacement URL',
      );
      assert.equal(await address.inputValue(), `${siteOrigin}/next`);
      await page.locator('.browser-tab-select').nth(0).click();
      await page.locator('.browser-tab-select').nth(1).click();
      await until(
        async () => (await address.inputValue()) === `${siteOrigin}/next`,
        'The recovered address did not survive switching tabs',
      );
      assert.equal(await error.count(), 0);
    } finally {
      await page.locator('.browser-tab-close').nth(1).click();
      await until(
        async () => (await activeGuest(app)).id === firstGuest,
        'Closing the recovered tab did not restore the original guest',
      );
      await readyViewport(app);
    }
  });
});
