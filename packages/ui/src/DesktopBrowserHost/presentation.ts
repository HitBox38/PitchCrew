import type { CSSProperties } from 'react';
import type { DesktopBrowserView } from '../../../core/src/native-browser.ts';

/** Fired on a press over a read-only page so its panel can offer or take manual control. */
export const browserGuardPressEvent = 'pitchcrew:browser-guard-press';

export const initialBrowserSize = { width: 1280, height: 800 };
export type BrowserViewSize = typeof initialBrowserSize;

/** Maps a page CSS-pixel point to window coordinates for a presented guest, or null if hidden. */
/** The scale and top-left of the displayed page: a fixed viewport is centred and scaled to fit. */
const pageTransform = (view: DesktopBrowserView) => {
  if (!view.bounds) return null;
  const page = view.viewport ?? { width: view.bounds.width, height: view.bounds.height };
  const scale = Math.min(1, view.bounds.width / page.width, view.bounds.height / page.height);
  return {
    scale,
    x: view.bounds.x + (view.bounds.width - page.width * scale) / 2,
    y: view.bounds.y,
  };
};

export const browserPagePoint = (view: DesktopBrowserView, point: { x: number; y: number }) => {
  const transform = pageTransform(view);
  if (!transform || !view.bounds) return null;
  const x = transform.x + point.x * transform.scale;
  const y = transform.y + point.y * transform.scale;
  const inside =
    x >= view.bounds.x &&
    y >= view.bounds.y &&
    x <= view.bounds.x + view.bounds.width &&
    y <= view.bounds.y + view.bounds.height;
  return inside ? { x, y } : null;
};

/** A page box in window coordinates; callers clip it to the page frame. */
export const browserPageRect = (
  view: DesktopBrowserView,
  rect: { x: number; y: number; width: number; height: number },
) => {
  const transform = pageTransform(view);
  if (!transform) return null;
  return {
    x: transform.x + rect.x * transform.scale,
    y: transform.y + rect.y * transform.scale,
    width: rect.width * transform.scale,
    height: rect.height * transform.scale,
  };
};

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
    // A paint lease keeps Chromium capture/input alive; it does not select a tab.
    // Negative stacking alone cannot conceal guests inside the expanded dialog's
    // stacking context. Keep their native surfaces transparent even while painting.
    opacity: view.bounds ? 1 : 0,
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

/** Which edge a mostly hidden target lies past, so the page can point to it; null when in view. */
export const targetEdge = (
  frame: { y: number; height: number },
  rect: { y: number; height: number },
): 'above' | 'below' | null => {
  const top = Math.max(rect.y, frame.y);
  const bottom = Math.min(rect.y + rect.height, frame.y + frame.height);
  const visible = Math.max(0, bottom - top);
  if (visible >= Math.min(rect.height, 24) * 0.5) return null;
  return rect.y + rect.height / 2 < frame.y + frame.height / 2 ? 'above' : 'below';
};
