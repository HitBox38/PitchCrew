/** Observe committed controls, scoped to one concrete user interaction rather than any page input. */
export const observeSettingsSaves = (
  root: HTMLElement,
  persisted: (control: HTMLElement) => boolean,
  announce: (message: string) => void,
) => {
  const controlSelector = '[role="switch"], [role="checkbox"], [role="radio"]';
  let intent: { control: HTMLElement; group: Element | null; expires: number } | null = null;
  const timers = new Map<Element, ReturnType<typeof setTimeout>>();
  const failures = new Set<string>();
  const sessionNotice =
    'Applied for this session. Device storage is unavailable; this change may not survive a restart.';
  const mark = (event: Event) => {
    if (!(event.target instanceof Element)) return;
    const keyboard = event instanceof KeyboardEvent;
    if (
      keyboard &&
      ![' ', 'Enter', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)
    )
      return;
    const label = event.target.closest('label');
    const labelled = label?.htmlFor ? document.getElementById(label.htmlFor) : null;
    const control =
      event.target.closest<HTMLElement>(controlSelector) ??
      (labelled?.matches(controlSelector)
        ? labelled
        : labelled?.parentElement?.querySelector<HTMLElement>(controlSelector));
    if (!control || !root.contains(control) || control.matches(':disabled, [aria-disabled="true"]'))
      return;
    intent = {
      control,
      group:
        keyboard && event.key.startsWith('Arrow') ? control.closest('[role="radiogroup"]') : null,
      expires: Date.now() + 4000,
    };
  };
  const observer = new MutationObserver((records) => {
    if (!intent || intent.expires < Date.now()) return;
    for (const record of records) {
      const control = record.target as HTMLElement;
      if (
        control !== intent.control &&
        !(intent.group && control.closest('[role="radiogroup"]') === intent.group)
      )
        continue;
      if (
        control.getAttribute('role') === 'radio' &&
        control.getAttribute('aria-checked') !== 'true'
      )
        continue;
      if (control.getAttribute('aria-checked') === record.oldValue) continue;
      const row = control.closest('.settings-row, [data-autosave]');
      if (!row) continue;
      const group = control.closest('[role="radiogroup"]');
      const key =
        group?.id ||
        group?.getAttribute('aria-labelledby') ||
        control.closest('label')?.htmlFor ||
        control.id;
      intent = null;
      const previous = timers.get(row);
      if (previous) clearTimeout(previous);
      timers.delete(row);
      row.removeAttribute('data-saved');
      if (!persisted(control)) {
        failures.add(key);
        announce(sessionNotice);
        break;
      }
      failures.delete(key);
      row.setAttribute('data-saved', '');
      announce('Saved');
      timers.set(
        row,
        setTimeout(() => {
          row.removeAttribute('data-saved');
          timers.delete(row);
          if (!timers.size && !failures.size) announce('');
        }, 2000),
      );
      break;
    }
  });
  observer.observe(root, {
    subtree: true,
    attributes: true,
    attributeOldValue: true,
    attributeFilter: ['aria-checked'],
  });
  root.addEventListener('click', mark, true);
  root.addEventListener('keydown', mark, true);
  return () => {
    observer.disconnect();
    root.removeEventListener('click', mark, true);
    root.removeEventListener('keydown', mark, true);
    for (const [row, timer] of timers) {
      clearTimeout(timer);
      row.removeAttribute('data-saved');
    }
  };
};
