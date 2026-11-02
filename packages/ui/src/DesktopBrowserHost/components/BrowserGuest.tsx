import { createElement, useLayoutEffect, useState } from 'react';
import type { DesktopBrowserView } from '../../../../core/src/native-browser.ts';
import { browserViewStyle, initialBrowserSize, type BrowserViewSize } from '../presentation.ts';

type GuestElement = HTMLElement & { getWebContentsId(): number };

export const BrowserGuest = ({
  view,
  viewport,
}: {
  view: DesktopBrowserView;
  viewport: BrowserViewSize;
}) => {
  const [element, attach] = useState<GuestElement | null>(null);
  const [size, setSize] = useState(initialBrowserSize);
  if (view.bounds && (view.bounds.width !== size.width || view.bounds.height !== size.height))
    setSize({ width: view.bounds.width, height: view.bounds.height });
  useLayoutEffect(() => {
    const guest = element;
    if (!guest) return;
    const register = () => {
      void window.pitchcrewBrowser
        ?.registerView(view.token, guest.getWebContentsId())
        .catch(() => {});
    };
    const focus = () => {
      // Guest input does not bubble into the app. Dismiss app menus through the
      // browser's own anchor so its containing sheet remains open.
      const anchor = document.querySelector('[aria-label="Native browser page"]');
      anchor?.dispatchEvent(
        new PointerEvent('pointerdown', {
          bubbles: true,
          button: 0,
          pointerType: 'mouse',
        }),
      );
    };
    const escape = (event: Event) => {
      if (
        (event as Event & { channel?: string }).channel !== 'pitchcrew:browser:escape' ||
        !view.bounds ||
        !view.manual ||
        !guest.closest('[data-desktop-browser-layer][data-expanded]')
      )
        return;
      // Guest DOM events cannot bubble into the app. Re-enter the containing
      // dialog's normal Escape path, retaining nested app-surface precedence.
      guest.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }),
      );
    };
    guest.addEventListener('dom-ready', register);
    guest.addEventListener('focus', focus);
    guest.addEventListener('ipc-message', escape);
    return () => {
      guest.removeEventListener('dom-ready', register);
      guest.removeEventListener('focus', focus);
      guest.removeEventListener('ipc-message', escape);
    };
  }, [view.token, view.bounds, view.manual, element]);
  return (
    <>
      {createElement('webview', {
        ref: attach,
        'data-browser-view': view.token,
        'aria-label': 'Browser web page',
        src: `about:blank#pitchcrew-${view.token}`,
        partition: view.partition,
        allowpopups: '',
        tabIndex: view.bounds && view.manual ? 0 : -1,
        style: browserViewStyle(view, size, viewport, /mac/i.test(navigator.platform)),
      })}
      {view.bounds && !view.manual ? (
        <div
          data-browser-input-guard={view.token}
          aria-hidden="true"
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
      ) : null}
    </>
  );
};
