import assert from 'node:assert/strict';
import { once } from 'node:events';
import type { BrowserWindow, View } from 'electron';
import { createNativeGroup, type NativeGroup } from '../../src/browser/pages.ts';

/** Exercise composition inside the shared native fixture's existing window and lifecycle. */
export const checkNativeBrowserPresentation = async (window: BrowserWindow, appView: View) => {
  const root = window.contentView;
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
    assert.ok(root.children.indexOf(view) < root.children.indexOf(appView));
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
      // Hidden automation guests start at (0, 0). Opening must position before raising.
      group.mount(bounds);
      assert.ok(additions.length > 0, 'Opening must raise the guest above the app');
      assert.deepEqual(
        additions.at(-1)?.bounds,
        bounds,
        'The guest was attached outside its panel',
      );
      assert.ok(root.children.indexOf(view) > root.children.indexOf(appView));
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
      assert.ok(root.children.indexOf(view) < root.children.indexOf(appView));
      assert.ok(
        root.children.indexOf(group.views.get(second.id)!) > root.children.indexOf(appView),
      );
      group.select(first.id);
      assert.deepEqual(view.getBounds(), resized);

      // Hiding a panel keeps automation painting below the app, then detaches on idle.
      group.mount(null);
      assert.ok(view.getVisible());
      assert.ok(root.children.indexOf(view) < root.children.indexOf(appView));
      group.paint(first.id, false);
      assert.ok(!view.getVisible());
      assert.ok(!root.children.includes(view));
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
