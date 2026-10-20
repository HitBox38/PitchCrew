import { useEffect } from 'react';
import { useLocation } from '@tanstack/react-router';
import { settingEntries } from '../search.ts';
export const useSettingFocus = () => {
  const hash = useLocation({ select: (location) => location.hash });
  useEffect(() => {
    if (!settingEntries.some((entry) => entry.target === hash)) return;
    const reveal = () => {
      const anchor = document.getElementById(hash);
      if (!anchor || anchor.closest('[hidden]')) return false;
      const target = anchor.matches('input[aria-hidden="true"]')
        ? (anchor.parentElement?.querySelector<HTMLElement>('[role="switch"], [role="checkbox"]') ??
          anchor)
        : anchor;
      if (!target.matches('button, input, textarea, select, a[href], [tabindex]'))
        target.tabIndex = -1;
      target.focus({ preventScroll: true });
      target.scrollIntoView({ block: 'center', inline: 'nearest' });
      return true;
    };
    const observer = new MutationObserver(() => {
      if (reveal()) observer.disconnect();
    });
    const frame = requestAnimationFrame(() => {
      if (!reveal()) observer.observe(document.body, { childList: true, subtree: true });
    });
    const deadline = setTimeout(() => observer.disconnect(), 5000);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      clearTimeout(deadline);
    };
  }, [hash]);
};
