import { useEffect } from 'react';
import type { DesktopLinkBridge } from '@pitchcrew/core';
import { blockUnsafeLink, showBlockedLinkToast } from '../link-feedback.ts';

declare global {
  interface Window {
    pitchcrewLinks?: DesktopLinkBridge;
  }
}

export const useLinkFeedback = () => {
  useEffect(() => {
    const unsubscribe = window.pitchcrewLinks?.subscribe(showBlockedLinkToast);
    const checkLink = (event: MouseEvent) => {
      if (event.button > 1) return;
      const link = event.composedPath().find((element) => element instanceof HTMLAnchorElement);
      if (!link?.hasAttribute('href')) return;
      // Local exported document downloads do not leave the app or launch native protocols.
      if (link.hasAttribute('download') && link.href.startsWith(`blob:${location.origin}/`)) return;
      if (blockUnsafeLink(link.href)) {
        event.preventDefault();
        event.stopPropagation();
      }
    };
    document.addEventListener('click', checkLink, true);
    document.addEventListener('auxclick', checkLink, true);
    return () => {
      unsubscribe?.();
      document.removeEventListener('click', checkLink, true);
      document.removeEventListener('auxclick', checkLink, true);
    };
  }, []);
};
