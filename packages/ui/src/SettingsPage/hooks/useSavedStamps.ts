import { useEffect, useRef } from 'react';

const window_ = 4000;
const visible = 2000;

/**
 * Stamps "Saved" on an autosaving row after the user changes it. A switch or radio only changes
 * its checked state once its preference is stored (device preferences update synchronously,
 * daemon preferences only after the snapshot confirms them), so a change that follows the user's
 * own input is a truthful save confirmation. Failed saves leave the control unchanged.
 */
export const useSavedStamps = () => {
  const root = useRef<HTMLDivElement>(null);
  const status = useRef<HTMLOutputElement>(null);
  useEffect(() => {
    const element = root.current;
    if (!element) return;
    let interacted = 0;
    const mark = () => {
      interacted = Date.now();
    };
    const timers = new Map<Element, ReturnType<typeof setTimeout>>();
    const observer = new MutationObserver((records) => {
      if (Date.now() - interacted > window_) return;
      for (const record of records) {
        const row = (record.target as Element).closest('.settings-row, [data-autosave]');
        if (!row || timers.has(row)) continue;
        row.setAttribute('data-saved', '');
        if (status.current) status.current.textContent = 'Saved';
        timers.set(
          row,
          setTimeout(() => {
            row.removeAttribute('data-saved');
            timers.delete(row);
            if (status.current) status.current.textContent = '';
          }, visible),
        );
      }
    });
    observer.observe(element, {
      subtree: true,
      attributes: true,
      attributeFilter: ['aria-checked'],
    });
    element.addEventListener('pointerdown', mark, true);
    element.addEventListener('keydown', mark, true);
    return () => {
      observer.disconnect();
      element.removeEventListener('pointerdown', mark, true);
      element.removeEventListener('keydown', mark, true);
      for (const [row, timer] of timers) {
        clearTimeout(timer);
        row.removeAttribute('data-saved');
      }
    };
  }, []);
  return { root, status };
};
