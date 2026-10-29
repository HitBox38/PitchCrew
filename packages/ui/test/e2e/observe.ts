import assert from 'node:assert/strict';
import type { Locator } from 'playwright';
import { activeGuest, until, type DesktopE2E } from './harness.ts';
import type { ComputerApproval } from '../../../core/src/index.ts';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';

let captureNumber = 0;

export const guestPoint = async (app: DesktopE2E, selector: string, fraction = 0.5) => {
  const guest = await activeGuest(app);
  const box = await app.page.locator(`webview[data-browser-view="${guest.token}"]`).boundingBox();
  assert.ok(box);
  const point = await guest.read<{ x: number; y: number; width: number; height: number }>(
    `(() => { const r=document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect(); return {x:r.x+r.width*${fraction},y:r.y+r.height/2,width:innerWidth,height:innerHeight}; })()`,
  );
  return {
    x: box.x + (point.x * box.width) / point.width,
    y: box.y + (point.y * box.height) / point.height,
  };
};

export const assertLiveGuest = async (app: DesktopE2E, overlay?: Locator) => {
  const guest = await activeGuest(app);
  const before = await guest.read<number>(
    'Number(document.querySelector("#pulse").getAnimations()[0].currentTime)',
  );
  if (overlay) {
    // Base UI sheets translate during entry; visibility alone includes that interval.
    await overlay.click({ trial: true });
    const box = await overlay.boundingBox();
    assert.ok(box, 'The actual application overlay is not open');
    assert.equal(
      await app.page.evaluate(
        ({ x, y }) =>
          !!document
            .elementFromPoint(x, y)
            ?.closest(
              '[data-slot="popover-content"], [data-slot="context-menu-content"], [role="dialog"]',
            ),
        { x: box.x + box.width / 2, y: box.y + Math.min(20, box.height / 2) },
      ),
      true,
      'The web page covered the app overlay',
    );
  }
  const point = await guestPoint(app, '#pulse', 0.1);
  const colors = new Set<string>();
  const unexpected: number[][] = [];
  let samples = 0;
  await until(async () => {
    const pixel = await app.electron.evaluate(async ({ BrowserWindow }, point) => {
      const window = BrowserWindow.getAllWindows()[0];
      const size = window.getContentBounds();
      const image = (
        await window.webContents.capturePage(undefined, { stayHidden: true, stayAwake: true })
      ).resize({ width: size.width, height: size.height });
      const bytes = image.toBitmap({ scaleFactor: 1 });
      const offset = (Math.floor(point.y) * size.width + Math.floor(point.x)) * 4;
      return [bytes[offset + 2], bytes[offset + 1], bytes[offset]];
    }, point);
    const color = pixel[0] > pixel[2] * 2 ? 'red' : pixel[2] > pixel[0] * 2 ? 'blue' : undefined;
    if (colors.size && !color) unexpected.push(pixel);
    if (color) {
      colors.add(color);
      samples++;
    }
    return colors.size === 2 && samples >= 8;
  }, 'The real native compositor did not keep updating its visible page beneath the overlay').catch(
    async (error) => {
      const current = await guestPoint(app, '#pulse', 0.1);
      throw new Error(
        `${String(error)}; colors=${[...colors].join(',')}, samples=${samples}, point=${JSON.stringify(point)}, current=${JSON.stringify(current)}`,
      );
    },
  );
  assert.deepEqual(
    unexpected,
    [],
    'The live guest flashed blank or disappeared between compositor frames',
  );
  assert.equal((await activeGuest(app)).id, guest.id, 'An app overlay replaced the native guest');
  assert.ok(
    (await guest.read<number>(
      'Number(document.querySelector("#pulse").getAnimations()[0].currentTime)',
    )) > before,
  );
  const png = await app.electron.evaluate(async ({ BrowserWindow }) =>
    (
      await BrowserWindow.getAllWindows()[0].webContents.capturePage(undefined, {
        stayHidden: true,
        stayAwake: true,
      })
    )
      .toPNG()
      .toString('base64'),
  );
  await writeFile(
    join(app.directory, `live-page-${++captureNumber}.png`),
    Buffer.from(png, 'base64'),
  );
};

export const send = async (app: DesktopE2E, text: string) => {
  await app.page.getByRole('textbox', { name: 'Message Writer', exact: true }).fill(text);
  await app.page.getByRole('button', { name: 'Send message', exact: true }).click();
};

export const navigate = async (app: DesktopE2E, url: string, title: string) => {
  await app.page.getByRole('textbox', { name: 'Browser address' }).fill(url);
  await app.page.getByRole('button', { name: 'Go to address', exact: true }).click();
  return until(async () => {
    const guest = await activeGuest(app);
    return (await guest.read('document.title')) === title &&
      (await guest.read('location.href')) === url
      ? guest
      : undefined;
  }, `UI navigation did not reach ${title}`);
};

export const readyViewport = (app: DesktopE2E) =>
  until(async () => {
    const guest = await activeGuest(app);
    const expected = await app.page
      .getByLabel('Native browser page', { exact: true })
      .evaluate((element) => ({
        width: Math.max(240, Math.min(2560, (element as HTMLElement).offsetWidth - 2)),
        height: Math.max(160, Math.min(2160, (element as HTMLElement).offsetHeight - 2)),
      }));
    const actual = await guest.read<{ width: number; height: number }>(
      '({width:innerWidth,height:innerHeight})',
    );
    return expected.width === actual.width && expected.height === actual.height ? guest : undefined;
  }, 'The native viewport did not settle after its UI transition');

/** Observe the real HTTP projection; never decide an obsolete action or skip its gate. */
export const readyApproval = async (app: DesktopE2E) => {
  const pending = app.page.getByRole('region', { name: 'Pending browser action', exact: true });
  await pending.waitFor({ timeout: 25000 });
  await until(
    async () => {
      const id = await pending.getAttribute('data-browser-approval-id');
      const approval = await app.page.evaluate(async (id) => {
        const response = await fetch('/api/snapshot', { headers: { 'x-pitchcrew-client': 'ui' } });
        if (!response.ok) throw new Error('Cannot observe the current approval through HTTP');
        const snapshot = (await response.json()) as { computerApprovals: ComputerApproval[] };
        return snapshot.computerApprovals.find((approval) => approval.id === id);
      }, id);
      const size = await app.page
        .getByLabel('Native browser page', { exact: true })
        .evaluate((element) => ({
          width: Math.max(240, Math.min(2560, (element as HTMLElement).offsetWidth - 2)),
          height: Math.max(160, Math.min(2160, (element as HTMLElement).offsetHeight - 2)),
        }));
      const guest = await activeGuest(app);
      const actual = await guest.read<{ width: number; height: number }>(
        '({width:innerWidth,height:innerHeight})',
      );
      return (
        approval?.status === 'pending' &&
        approval.page.viewport?.width === size.width &&
        approval.page.viewport.height === size.height &&
        actual.width === size.width &&
        actual.height === size.height
      );
    },
    'No fresh UI approval matched the actual rendered browser viewport',
    25000,
  );
  return pending;
};
