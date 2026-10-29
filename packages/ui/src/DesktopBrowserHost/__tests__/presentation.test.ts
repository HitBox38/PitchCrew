import { expect, it } from 'vitest';
import type { DesktopBrowserView } from '../../../../core/src/native-browser.ts';
import { browserViewStyle } from '../presentation.ts';

const view: DesktopBrowserView = {
  token: 'guest',
  partition: 'persist:fixture',
  contentsId: 1,
  bounds: { x: 400, y: 200, width: 700, height: 500 },
  painting: false,
  manual: true,
};

it('keeps the selected page live within renderer stacking across paint activity', () => {
  const shown = browserViewStyle(view);
  expect(shown).toMatchObject({
    left: 400,
    top: 200,
    width: 700,
    height: 500,
    visibility: 'visible',
    pointerEvents: 'auto',
  });
  expect(shown.zIndex).toBeLessThan(50);
  expect(browserViewStyle({ ...view, painting: true })).toEqual(shown);
  expect(browserViewStyle({ ...view, manual: false })).toMatchObject({
    visibility: 'visible',
    pointerEvents: 'none',
  });
});

it('retains OOPIF hit-testing for agent input while the separate readonly shield owns human input', () => {
  expect(browserViewStyle({ ...view, manual: false, painting: true }).pointerEvents).toBe('auto');
  expect(
    browserViewStyle({ ...view, bounds: null, manual: false, painting: true }).pointerEvents,
  ).toBe('auto');
  expect(browserViewStyle({ ...view, manual: false, painting: false }).pointerEvents).toBe('none');
});

it('keeps background automation inside the viewport at its saved page size', () => {
  const background = browserViewStyle({ ...view, bounds: null, painting: true }, view.bounds!);
  expect(background).toMatchObject({
    left: 0,
    top: 0,
    width: 700,
    height: 500,
    zIndex: -1,
    visibility: 'visible',
    pointerEvents: 'auto',
  });
  expect(browserViewStyle({ ...view, bounds: null }).visibility).toBe('hidden');
});

it('lets a pending blank guest render before main-process registration', () => {
  expect(browserViewStyle({ ...view, bounds: null, contentsId: undefined })).toMatchObject({
    left: 0,
    top: 0,
    width: 1280,
    height: 800,
    zIndex: -1,
    visibility: 'visible',
    pointerEvents: 'none',
  });
});

it('fits background painting inside narrow windows without changing its layout viewport', () => {
  expect(
    browserViewStyle(
      { ...view, bounds: null, painting: true },
      { width: 1280, height: 800 },
      { width: 640, height: 600 },
    ),
  ).toMatchObject({
    width: 1280,
    height: 800,
    transform: 'scale(0.5)',
    transformOrigin: 'top left',
  });
});

it('never scales the selected page', () => {
  expect(
    browserViewStyle(view, { width: 1280, height: 800 }, { width: 390, height: 844 }),
  ).toMatchObject({ width: 700, height: 500, transform: 'none' });
});

it('parks idle macOS guests offscreen without hiding or destroying their compositor', () => {
  expect(browserViewStyle({ ...view, bounds: null }, undefined, undefined, true)).toMatchObject({
    left: -100000,
    top: -100000,
    visibility: 'visible',
    pointerEvents: 'none',
    zIndex: -1,
  });
});

it('fits device presentation to the available space while preserving the inspected layout viewport', () => {
  const fixed = browserViewStyle({ ...view, viewport: { width: 390, height: 844 } });
  expect(fixed.width).toBe(390);
  expect(fixed.height).toBe(844);
  expect(fixed.transform).toBe(`scale(${500 / 844})`);
});
