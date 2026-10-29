import assert from 'node:assert/strict';
import { setTimeout as delay } from 'node:timers/promises';
import type { BrowserWindow } from 'electron';
import { nativeImage } from 'electron';
import { captureNativePage } from '../../src/browser/capture.ts';
import type { createNativeBrowserHost } from '../../src/browser/host.ts';
import type { NativeGroup } from '../../src/browser/pages.ts';

const waitFor = async (read: () => Promise<boolean>, message: string) => {
  const until = performance.now() + 5000;
  while (performance.now() < until) {
    if (await read()) return;
    await delay(20);
  }
  throw new Error(message);
};

/** Actual Chromium composition: app overlays stay above a live, unchanged guest. */
export const checkNativeBrowserPresentation = async (
  window: BrowserWindow,
  host: Awaited<ReturnType<typeof createNativeBrowserHost>>,
  group: NativeGroup,
  background: NativeGroup,
) => {
  const page = group.pages.get(group.active)!;
  const bounds = { x: 50, y: 100, width: 700, height: 500 };
  const read = <T>(source: string) => window.webContents.executeJavaScript(source) as Promise<T>;
  const guest = `Array.from(document.querySelectorAll('webview')).find(node => { try { return node.getWebContentsId() === ${page.contents.id}; } catch { return false; } })`;
  const visible = () =>
    read<boolean>(
      `(() => { const node = ${guest}; return !!node && node.style.visibility === 'visible' && node.getBoundingClientRect().x === 50 && node.getBoundingClientRect().width === 700; })()`,
    );
  host.mount(background.id, bounds);
  host.mount(group.id, bounds);
  await waitFor(visible, 'Selected DOM guest did not reach its browser slot');
  await page.contents.executeJavaScript(
    `document.documentElement.style.background = 'rgb(225, 40, 25)'; document.body.style.background = 'rgb(225, 40, 25)';`,
  );
  const before = await read<{ created: number; destroyed: number }>(
    `({ created: window.nativeFixture.created, destroyed: window.nativeFixture.destroyed })`,
  );
  const pixel = async (x: number, y: number) => {
    const { width, height } = window.getContentBounds();
    const image = (
      await window.webContents.capturePage(undefined, { stayHidden: true, stayAwake: true })
    ).resize({ width, height });
    const bitmap = image.toBitmap({ scaleFactor: 1 });
    const offset = (y * width + x) * 4;
    return [bitmap[offset + 2], bitmap[offset + 1], bitmap[offset]];
  };
  const isRed = (value: number[]) => value[0] > 190 && value[1] < 80 && value[2] < 80;
  await waitFor(
    async () => isRed(await pixel(600, 450)),
    'The native guest was absent from app composition',
  );
  const backgroundPage = background.pages.get(background.active)!;
  await backgroundPage.contents.executeJavaScript(
    `document.documentElement.style.background = 'rgb(25, 200, 40)'; document.body.style.background = 'rgb(25, 200, 40)';`,
  );
  // Native contentView children used to cover the renderer even when reordered.
  // DOM guests must keep background captures live without covering app pixels.
  background.paint(background.active, true);
  try {
    await waitFor(async () => {
      const capture = await captureNativePage(backgroundPage.contents, { format: 'png' });
      const image = nativeImage.createFromBuffer(Buffer.from(capture.data, 'base64'));
      const { width, height } = image.getSize();
      const bytes = image.toBitmap({ scaleFactor: 1 });
      const offset = (Math.floor(height / 2) * width + Math.floor(width / 2)) * 4;
      return bytes[offset + 1] > 170 && bytes[offset] < 80 && bytes[offset + 2] < 80;
    }, 'The inactive DOM guest stopped painting for native capture');
    for (let cycle = 0; cycle < 3; cycle++) {
      assert.deepEqual(
        await pixel(900, 600),
        [242, 241, 236],
        'An inactive guest covered the app renderer',
      );
      assert.ok(isRed(await pixel(600, 450)), 'An inactive guest covered the selected page');
    }
  } finally {
    background.paint(background.active, false);
  }
  for (const kind of [
    'context-menu-content',
    'popover-content',
    'dialog-content',
    'sheet-content',
  ]) {
    await read(
      `(() => { const overlay = document.createElement('div'); overlay.id = 'fixture-overlay'; overlay.dataset.slot = '${kind}'; Object.assign(overlay.style, { position: 'fixed', left: '80px', top: '130px', width: '200px', height: '100px', zIndex: '50', background: 'rgb(25, 200, 40)' }); document.body.append(overlay); })()`,
    );
    for (let cycle = 0; cycle < 5; cycle++) {
      background.paint(background.active, true);
      group.paint(group.active, true);
      group.paint(group.active, false);
      background.paint(background.active, false);
      host.mount(group.id, bounds);
    }
    await waitFor(async () => {
      const overlay = await pixel(150, 160);
      return overlay[0] < 80 && overlay[1] > 170 && overlay[2] < 80;
    }, `${kind} did not composite above the live page`);
    assert.ok(isRed(await pixel(600, 450)), `${kind} hid the uncovered browser page`);
    await page.contents.executeJavaScript(
      `document.documentElement.style.background = 'rgb(25, 40, 225)'; document.body.style.background = 'rgb(25, 40, 225)';`,
    );
    await waitFor(async () => {
      const live = await pixel(600, 450);
      return live[0] < 80 && live[1] < 80 && live[2] > 190;
    }, `${kind} froze the uncovered browser page`);
    await page.contents.executeJavaScript(
      `document.documentElement.style.background = 'rgb(225, 40, 25)'; document.body.style.background = 'rgb(225, 40, 25)';`,
    );
    assert.ok(await visible(), `${kind} changed native page presentation`);
    assert.equal(group.pages.get(group.active)?.contents, page.contents);
    await read(`document.querySelector('#fixture-overlay').remove()`);
    await waitFor(
      async () => isRed(await pixel(600, 450)),
      'Closing an overlay did not retain the live page',
    );
  }
  const after = await read<{ created: number; destroyed: number; errors: string[] }>(
    `({ ...window.nativeFixture })`,
  );
  assert.equal(after.created, before.created, 'An overlay recreated a browser guest');
  assert.equal(after.destroyed, before.destroyed, 'An overlay destroyed a browser guest');
  assert.deepEqual(after.errors, []);
  assert.ok(!window.isVisible() && !window.isFocused(), 'The fixture showed or focused its window');
};
