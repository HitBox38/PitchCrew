import assert from 'node:assert/strict';
import { once } from 'node:events';
import { nativeImage, type BrowserWindow, type View } from 'electron';
import { createNativeGroup, type NativeGroup } from '../../src/browser/pages.ts';

/** Exercise composition inside the shared native fixture's existing window and lifecycle. */
export const checkNativeBrowserPresentation = async (window: BrowserWindow) => {
  const root = window.contentView;
  const assertParked = (view: View) => {
    const bounds = view.getBounds();
    assert.ok(
      bounds.x + bounds.width <= 0 && bounds.y + bounds.height <= 0,
      'An inactive guest can cover the app renderer',
    );
  };
  const centerGreen = (bytes: Buffer) => {
    const image = nativeImage.createFromBuffer(bytes);
    assert.ok(!image.isEmpty(), 'Native capture returned an empty frame');
    const { width, height } = image.getSize();
    const pixels = image.toBitmap({ scaleFactor: 1 });
    return pixels[(Math.floor(height / 2) * width + Math.floor(width / 2)) * 4 + 1];
  };
  const groups: NativeGroup[] = [];
  let shown = false;
  const markShown = () => {
    shown = true;
  };
  window.on('show', markShown);
  window.on('focus', markShown);
  const group = createNativeGroup(
    'fixture',
    'a'.repeat(64),
    () => window,
    () => groups,
  );
  groups.push(group);
  try {
    const first = await group.create();
    const view = group.views.get(first.id)!;
    group.paint(first.id, true);
    assertParked(view);
    const bounds = { x: 600, y: 160, width: 300, height: 400 };
    const additions: { view: View; bounds: Electron.Rectangle }[] = [];
    const removals: View[] = [];
    const visibility: boolean[] = [];
    const add = root.addChildView;
    const remove = root.removeChildView;
    const visible = view.setVisible;
    root.addChildView = (...args) => {
      additions.push({ view: args[0], bounds: args[0].getBounds() });
      add.apply(root, args);
    };
    root.removeChildView = (child) => {
      removals.push(child);
      remove.call(root, child);
    };
    view.setVisible = (value) => {
      visibility.push(value);
      visible.call(view, value);
    };
    try {
      // Automation guests are parked outside the viewport. Position before raising.
      group.mount(bounds);
      assert.ok(additions.length > 0, 'Opening must raise the guest above the app');
      assert.deepEqual(
        additions.at(-1)?.bounds,
        bounds,
        'The guest was attached outside its panel',
      );
      assert.equal(root.children.at(-1), view);
      assert.ok(view.getVisible());
      additions.length = 0;
      removals.length = 0;
      visibility.length = 0;

      // Automation and layout notifications must not tear down the displayed native surface.
      group.paint(first.id, false);
      group.paint(first.id, true);
      group.mount(bounds);
      const resized = { ...bounds, x: 620, width: 280 };
      group.mount(resized);
      assert.equal(additions.length, 0, 'A mounted guest was unnecessarily reattached');
      assert.equal(removals.length, 0, 'A mounted guest was unnecessarily detached');
      assert.ok(!visibility.includes(false), 'A mounted guest was unnecessarily hidden');
      assert.deepEqual(view.getBounds(), resized);

      // Tab switches must position the new page before attaching it as well.
      const second = await group.create();
      assert.deepEqual(additions.at(-1)?.bounds, resized);
      assert.equal(additions.at(-1)?.view, group.views.get(second.id));
      assertParked(view);
      assert.equal(root.children.at(-1), group.views.get(second.id));
      group.select(first.id);
      assert.deepEqual(view.getBounds(), resized);

      // Hiding a panel parks automation off-window, then detaches on idle.
      group.mount(null);
      assert.ok(view.getVisible());
      assertParked(view);
      group.paint(first.id, false);
      assert.ok(!view.getVisible());
      assert.ok(!root.children.includes(view));
      // A previous job can continue producing automation frames while the next
      // chat's browser is blank. None of those frames may enter the app viewport.
      const other = createNativeGroup(
        'fixture',
        'b'.repeat(64),
        () => window,
        () => groups,
      );
      groups.push(other);
      try {
        const next = await other.create();
        await first.contents.executeJavaScript(
          "document.body.innerHTML='First job'; document.body.style.background='red'; document.documentElement.style.background='red'",
        );
        await next.contents.executeJavaScript(
          "document.body.innerHTML='Second job'; document.body.style.background='lime'; document.documentElement.style.background='lime'",
        );
        for (let cycle = 0; cycle < 4; cycle++) {
          group.mount(null);
          other.mount(cycle ? bounds : null);
          const capture = (await first.send('Page.captureScreenshot', { format: 'png' })) as {
            data: string;
          };
          assertParked(view);
          assert.ok(view.getVisible(), 'Parked automation stopped painting');
          assert.ok(
            centerGreen(Buffer.from(capture.data, 'base64')) < 10,
            'A parked job captured another job’s page',
          );
          if (cycle) {
            const selected = other.views.get(next.id)!;
            assert.equal(root.children.at(-1), selected);
            assert.deepEqual(selected.getBounds(), bounds);
            const selectedCapture = (await next.send('Page.captureScreenshot', {
              format: 'png',
            })) as { data: string };
            assert.ok(
              centerGreen(Buffer.from(selectedCapture.data, 'base64')) > 240,
              'The selected job showed the old page',
            );
          }
        }
        group.mount(bounds);
        other.mount(null);
        assertParked(other.views.get(next.id)!);
        assert.equal(root.children.at(-1), view);
        assert.deepEqual(view.getBounds(), bounds);
      } finally {
        const closed = Promise.all(
          [...other.pages.values()].map(({ contents }) => once(contents, 'destroyed')),
        );
        other.destroy();
        await closed;
      }
      assert.ok(!shown && !window.isVisible(), 'The fixture showed or focused a window');
    } finally {
      root.addChildView = add;
      root.removeChildView = remove;
      view.setVisible = visible;
    }
  } finally {
    const closed = Promise.all(
      [...group.pages.values()].map(({ contents }) => once(contents, 'destroyed')),
    );
    group.destroy();
    await closed;
    window.off('show', markShown);
    window.off('focus', markShown);
  }
};
