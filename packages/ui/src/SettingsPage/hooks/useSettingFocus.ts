import { useEffect } from 'react';
import { useLocation } from '@tanstack/react-router';
import { settingEntries } from '../search.ts';
import { useWorkspaceStore } from '@/WorkspaceStore/index.ts';
export const useSettingFocus = () => {
  const hash = useLocation({ select: (location) => location.hash });
  const navigation = useLocation({
    select: (location) => location.state.settingsFocus ?? location.state.__TSR_key,
  });
  const knownRuntime = useWorkspaceStore(
    (state) => state.data?.runtimes.some((runtime) => `runtime-${runtime.id}` === hash) ?? false,
  );
  useEffect(() => {
    if (!knownRuntime && !settingEntries.some((entry) => entry.target === hash)) return;
    let highlighted: HTMLElement | undefined;
    let highlightTimer: ReturnType<typeof setTimeout> | undefined;
    const reveal = () => {
      const anchor = document.getElementById(hash);
      // The command dialog restores its trigger on close. Wait until that lifecycle finishes,
      // otherwise it steals focus back from the destination immediately after this runs.
      if (
        !anchor ||
        anchor.closest('[hidden], [inert]') ||
        document.querySelector('[role="dialog"][aria-modal="true"]')
      )
        return false;
      let target = anchor.matches('[role="radiogroup"]')
        ? (anchor.querySelector<HTMLElement>('[role="radio"][aria-checked="true"]') ?? anchor)
        : anchor.matches('input[aria-hidden="true"]')
          ? (anchor.parentElement?.querySelector<HTMLElement>(
              '[role="switch"], [role="checkbox"]',
            ) ?? anchor)
          : anchor;
      if (target.matches(':disabled, [aria-disabled="true"]'))
        target = target.closest<HTMLElement>('.settings-row, .settings-section') ?? target;
      if (!target.matches('button, input, textarea, select, a[href], [tabindex]'))
        target.tabIndex = -1;
      target.focus({ preventScroll: true });
      target.scrollIntoView({ block: 'center', inline: 'nearest' });
      target.setAttribute('data-setting-target', '');
      highlighted = target;
      highlightTimer = setTimeout(() => target.removeAttribute('data-setting-target'), 1800);
      return true;
    };
    const observer = new MutationObserver(() => {
      if (reveal()) observer.disconnect();
    });
    const frame = requestAnimationFrame(() => {
      if (!reveal())
        observer.observe(document.body, {
          childList: true,
          subtree: true,
          attributes: true,
          attributeFilter: ['hidden', 'inert', 'data-open'],
        });
    });
    const deadline = setTimeout(() => observer.disconnect(), 5000);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      clearTimeout(deadline);
      clearTimeout(highlightTimer);
      highlighted?.removeAttribute('data-setting-target');
    };
  }, [hash, navigation, knownRuntime]);
};
