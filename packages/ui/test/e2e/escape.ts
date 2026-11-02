import assert from 'node:assert/strict';
import { activeGuest, until, type DesktopE2E } from './harness.ts';
import { readyViewport } from './observe.ts';

/** Real trusted keys cross the sandboxed guest preload and production React layer. */
export const checkExpandedEscape = async (app: DesktopE2E) => {
  const { page } = app;
  const guest = await activeGuest(app);
  const expand = page.getByRole('button', { name: 'Expand browser', exact: true });
  const back = page.getByRole('button', { name: 'Back to chat', exact: true });
  const clickGuest = async (selector: string) => {
    const point = await guest.read<{ x: number; y: number }>(`(() => {
      const rect = document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect();
      return {x:rect.x + rect.width / 2,y:rect.y + rect.height / 2};
    })()`);
    await app.electron.evaluate(
      ({ webContents }, { id, point }) => {
        const contents = webContents.fromId(id)!;
        contents.focus();
        contents.sendInputEvent({ type: 'mouseDown', button: 'left', clickCount: 1, ...point });
        contents.sendInputEvent({ type: 'mouseUp', button: 'left', clickCount: 1, ...point });
      },
      { id: guest.id, point },
    );
  };
  const guestEscape = () =>
    app.electron.evaluate(({ webContents }, id) => {
      const contents = webContents.fromId(id)!;
      contents.sendInputEvent({ type: 'keyDown', keyCode: 'Escape' });
      contents.sendInputEvent({ type: 'keyUp', keyCode: 'Escape' });
    }, guest.id);
  const pressAndStay = async (context = 'website') => {
    await guestEscape();
    // A guest round trip followed by a renderer task drains the fallback IPC.
    await guest.read('new Promise(resolve => setTimeout(resolve, 100))');
    assert.equal(await back.isVisible(), true, `${context} lost Escape to the app`);
  };
  await expand.click();
  await readyViewport(app);
  // Hidden Electron windows have no OS focus. Direct trusted guest keys and
  // Chromium focus emulation exercise the website → preload → host route.
  await app.electron.evaluate(
    ({ webContents }, id) =>
      webContents
        .fromId(id)!
        .debugger.sendCommand('Emulation.setFocusEmulationEnabled', { enabled: true }),
    guest.id,
  );
  try {
    const draft = await guest.read('document.querySelector("#name").value');
    await clickGuest('#name');
    assert.equal(
      await guest.read('document.activeElement.id'),
      'name',
      'The page input did not receive focus',
    );
    await pressAndStay();
    assert.equal(await guest.read('document.activeElement.id'), 'name');

    await guest.read(`(() => {
      const root = document.createElement('div'); root.id = 'escape-fixture';
      root.innerHTML = '<textarea id="escape-area"></textarea><div id="escape-edit" contenteditable="true">Editable</div><div id="escape-shadow" style="display:inline-block"></div><div id="escape-menu" role="menu" hidden>Open menu</div><dialog id="escape-dialog"><p>Website dialog</p></dialog>';
      document.body.append(root);
      document.querySelector('#escape-shadow').attachShadow({mode:'open'}).innerHTML = '<input id="shadow-input">';
      window.escapeBehavior = '';
      window.escapeHandler = event => {
        if(event.key !== 'Escape') return;
        if(window.escapeBehavior === 'prevent') event.preventDefault();
        if(window.escapeBehavior === 'stop') event.stopPropagation();
        if(window.escapeBehavior === 'menu') document.querySelector('#escape-menu').hidden = true;
      };
      document.addEventListener('keydown', window.escapeHandler);
    })()`);
    for (const selector of ['#escape-area', '#escape-edit', '#escape-shadow']) {
      await clickGuest(selector);
      await pressAndStay(selector);
    }
    await clickGuest('h1');
    for (const behavior of ['prevent', 'stop', 'menu']) {
      await guest.read(`window.escapeBehavior = ${JSON.stringify(behavior)};
        document.querySelector('#escape-menu').hidden = ${behavior !== 'menu'};`);
      await pressAndStay(behavior);
      assert.equal(await guest.read('document.querySelector("#escape-menu").hidden'), true);
    }
    await guest.read(
      `window.escapeBehavior = ''; document.querySelector('#escape-dialog').showModal();`,
    );
    await pressAndStay();
    assert.equal(await guest.read('document.querySelector("#escape-dialog").open'), false);
    await guest.read(`document.removeEventListener('keydown', window.escapeHandler);
      document.querySelector('#escape-fixture').remove();`);

    // Real app menus and dialogs keep their existing first-Escape precedence.
    await page.getByRole('button', { name: 'Browser page settings', exact: true }).click();
    await page.keyboard.press('Escape');
    await page.locator('[data-slot="popover-content"]').waitFor({ state: 'detached' });
    assert.equal(await back.isVisible(), true);
    await page.getByRole('button', { name: 'Browser options', exact: true }).click();
    await page.getByRole('menuitem', { name: 'Reset saved sign-ins…', exact: true }).click();
    const dialog = page.getByRole('dialog', {
      name: 'Reset this agent’s browser?',
      exact: true,
      includeHidden: true,
    });
    await dialog.waitFor();
    await page.keyboard.press('Escape');
    await dialog.waitFor({ state: 'detached' });
    assert.equal(await back.isVisible(), true);

    await page.getByRole('button', { name: 'Browser page settings', exact: true }).click();
    await page.getByRole('button', { name: 'Toggle browser device toolbar', exact: true }).click();
    await page.keyboard.press('Escape');
    // Closing the settings popover restores focus to its trigger. Wait for that exit
    // before opening the preset select, or it can dismiss the selection mid-click.
    await page.locator('[data-slot="popover-content"]').waitFor({ state: 'detached' });
    await page.getByRole('combobox', { name: 'Browser viewport preset', exact: true }).click();
    await page.getByRole('option', { name: 'Desktop 1440', exact: true }).click();
    await until(
      async () => (await guest.read('innerWidth')) === 1440,
      'Fixed viewport was not applied',
    ).catch(async (error) => {
      const preset = await page
        .getByRole('combobox', { name: 'Browser viewport preset', exact: true })
        .innerText();
      const viewport = await guest.read('({width:innerWidth,height:innerHeight})');
      throw new Error(
        `${String(error)}; selected preset=${preset}; actual viewport=${JSON.stringify(viewport)}`,
        { cause: error },
      );
    });

    // The reproduction: static website content owns native keyboard focus.
    await clickGuest('h1');
    assert.equal(await guest.read('document.activeElement.tagName'), 'BODY');
    assert.equal(await guest.read('document.hasFocus()'), true);
    await guestEscape();
    await expand.waitFor();
    await until(
      async () => (await activeGuest(app)).id === guest.id,
      'The same guest did not return to split view',
    );
    assert.deepEqual(await guest.read('({width:innerWidth,height:innerHeight})'), {
      width: 1440,
      height: 900,
    });
    assert.equal(
      await page
        .getByRole('combobox', { name: 'Browser viewport preset', exact: true })
        .innerText(),
      'Desktop 1440',
    );
    assert.equal(await guest.read('document.querySelector("#name").value'), draft);
    assert.equal(
      await page
        .locator('.browser-panel-heading')
        .getByRole('button', { name: 'Return to agent', exact: true })
        .isVisible(),
      true,
    );

    // The original renderer path still works with focus in the activity panel.
    await expand.click();
    await page.locator('.browser-run-heading').click();
    await page.keyboard.press('Escape');
    await expand.waitFor();
    await until(
      async () => (await activeGuest(app)).id === guest.id,
      'The activity-panel Escape replaced the guest',
    );
    await until(
      async () => (await page.locator('[data-browser-input-guard]').count()) === 0,
      'Returning to chat changed manual-control ownership',
    );
  } finally {
    if (await back.isVisible()) await back.click();
    const preset = page.getByRole('combobox', { name: 'Browser viewport preset', exact: true });
    if (await preset.isVisible()) {
      await preset.click();
      await page.getByRole('option', { name: 'Fill panel', exact: true }).click();
      await page.getByRole('button', { name: 'Hide device toolbar', exact: true }).click();
    }
    await app.electron.evaluate(
      ({ webContents }, id) =>
        webContents
          .fromId(id)!
          .debugger.sendCommand('Emulation.setFocusEmulationEnabled', { enabled: false }),
      guest.id,
    );
  }
};
