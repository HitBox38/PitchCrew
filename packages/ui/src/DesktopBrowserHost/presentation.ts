import type { CSSProperties } from 'react';
import type { DesktopBrowserView } from '../../../core/src/native-browser.ts';

export const initialBrowserSize = { width: 1280, height: 800 };
export type BrowserViewSize = typeof initialBrowserSize;

export const browserViewStyle = (
  view: DesktopBrowserView,
  size = initialBrowserSize,
  viewport = size,
  keepPaintableWhenInactive = false,
): CSSProperties => {
  const page =
    view.viewport ??
    (view.bounds ? { width: view.bounds.width, height: view.bounds.height } : size);
  const frame = view.bounds ?? viewport;
  const scale = Math.min(1, frame.width / page.width, frame.height / page.height);
  const inactive = !view.bounds && !view.painting && !!view.contentsId;
  return {
    position: 'fixed',
    left: inactive
      ? -100000
      : view.bounds
        ? view.bounds.x + (view.bounds.width - page.width * scale) / 2
        : 0,
    top: inactive ? -100000 : (view.bounds?.y ?? 0),
    width: page.width,
    height: page.height,
    zIndex: view.bounds ? 1 : -1,
    // Chromium uses this hit-test region for OOPIF CDP input as well as human input.
    // A separate app-owned shield blocks humans while automation uses the guest.
    pointerEvents: view.painting || (view.bounds && view.manual) ? 'auto' : 'none',
    // Chromium on macOS can permanently blank a guest after visibility:hidden.
    // Follow T3's offscreen-but-paintable idle presentation on that platform.
    visibility: inactive && !keepPaintableWhenInactive ? 'hidden' : 'visible',
    display: 'flex',
    border: 0,
    // An entirely off-window guest stops compositing in Electron. Fit background
    // surfaces on screen without changing the page's layout viewport or evidence.
    transform: view.bounds && scale === 1 ? 'none' : `scale(${scale})`,
    transformOrigin: 'top left',
  };
};
