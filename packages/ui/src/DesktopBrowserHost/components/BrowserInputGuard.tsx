import type { DesktopBrowserView } from '../../../../core/src/native-browser.ts';
import { browserGuardPressEvent } from '../presentation.ts';

/**
 * The app-owned shield over a page the user is not controlling. Automation keeps the guest's
 * own hit-test region; this blocks human clicks until private control, and reports the press.
 */
export const BrowserInputGuard = ({ view }: { view: DesktopBrowserView }) => {
  if (!view.bounds || view.manual) return null;
  return (
    <div
      data-browser-input-guard={view.token}
      aria-hidden="true"
      onPointerDown={(event) => {
        if (event.button !== 0) return;
        window.dispatchEvent(new CustomEvent(browserGuardPressEvent, { detail: view.token }));
      }}
      style={{
        position: 'fixed',
        left: view.bounds.x,
        top: view.bounds.y,
        width: view.bounds.width,
        height: view.bounds.height,
        zIndex: 2,
        pointerEvents: 'auto',
      }}
    />
  );
};
