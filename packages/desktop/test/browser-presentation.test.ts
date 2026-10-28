import type { BrowserWindow, WebContentsView } from 'electron';
import { expect, it, vi } from 'vitest';
import { createNativeGroup } from '../src/browser/pages.ts';

vi.mock('electron', () => ({
  Menu: {},
  WebContentsView: class {},
  clipboard: {},
  session: {
    fromPartition: () => ({
      setPermissionCheckHandler: vi.fn(),
      setPermissionRequestHandler: vi.fn(),
      webRequest: { onBeforeRequest: vi.fn() },
      on: vi.fn(),
    }),
  },
}));

const fixture = () => {
  const appView = {} as WebContentsView;
  const children = [appView];
  const root = {
    children,
    addChildView: vi.fn((view: WebContentsView, index = children.length) => {
      children.splice(index, 0, view);
    }),
    removeChildView: vi.fn((view: WebContentsView) => {
      children.splice(children.indexOf(view), 1);
    }),
  };
  const window = { contentView: root } as unknown as BrowserWindow;
  const groups = [0, 1].map((index) => {
    const group = createNativeGroup(
      'owner',
      `profile-${index}`,
      () => window,
      () => groups,
    );
    let visible = false;
    let rectangle = { x: 0, y: 0, width: 1280, height: 800 };
    const view = {
      setVisible: vi.fn((value: boolean) => {
        visible = value;
      }),
      getVisible: () => visible,
      setBounds: vi.fn((value: typeof rectangle) => {
        rectangle = value;
      }),
      getBounds: () => rectangle,
    } as unknown as WebContentsView;
    group.views.set(`tab-${index}`, view);
    group.active = `tab-${index}`;
    return group;
  });
  return { appView, root, groups };
};
const bounds = { x: 50, y: 100, width: 700, height: 500 };

it('keeps the selected job guest attached while automation painting starts and stops', () => {
  const { root, groups } = fixture();
  const [first, second] = groups;
  first.mount(bounds);
  first.mount(null);
  second.mount(bounds);
  const selected = second.views.get(second.active)!;
  vi.mocked(selected.setVisible).mockClear();
  root.removeChildView.mockClear();
  root.addChildView.mockClear();
  for (let cycle = 0; cycle < 3; cycle++) {
    second.paint(second.active, true);
    second.paint(second.active, false);
    second.mount(bounds);
  }
  expect(root.removeChildView).not.toHaveBeenCalledWith(selected);
  expect(root.addChildView).not.toHaveBeenCalledWith(selected);
  expect(selected.setVisible).not.toHaveBeenCalledWith(false);
});

it('keeps background session painting below the app and selected session', () => {
  const {
    root,
    appView,
    groups: [first, second],
  } = fixture();
  first.mount(bounds);
  first.mount(null);
  second.mount(bounds);
  const background = first.views.get(first.active)!;
  const selected = second.views.get(second.active)!;
  for (let cycle = 0; cycle < 3; cycle++) {
    first.paint(first.active, true);
    expect(root.children).toEqual([background, appView, selected]);
    first.paint(first.active, false);
    expect(root.children).toEqual([appView, selected]);
  }
});

it('resizes in place and moves a still-painting guest behind the app when its panel closes', () => {
  const {
    root,
    appView,
    groups: [first],
  } = fixture();
  first.paint(first.active, true);
  first.mount(bounds);
  const view = first.views.get(first.active)!;
  vi.mocked(view.setVisible).mockClear();
  root.removeChildView.mockClear();
  const resized = { ...bounds, width: 600 };
  first.mount(resized);
  expect(view.getBounds()).toEqual(resized);
  expect(view.setVisible).not.toHaveBeenCalled();
  expect(root.removeChildView).not.toHaveBeenCalled();
  first.mount(null);
  expect(root.children).toEqual([view, appView]);
  expect(view.getVisible()).toBe(true);
  first.paint(first.active, false);
  expect(root.children).toEqual([appView]);
  expect(view.getVisible()).toBe(false);
});
