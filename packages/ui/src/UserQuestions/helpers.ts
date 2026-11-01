type AnswerKey = { key: string; shiftKey: boolean; altKey: boolean; isComposing: boolean };

/** Enter answers, as in the message box; Shift+Enter adds a line and IME composition is left alone. */
export const submitsAnswer = ({ key, shiftKey, altKey, isComposing }: AnswerKey) =>
  key === 'Enter' && !shiftKey && !altKey && !isComposing;

type ShortcutKey = Pick<KeyboardEvent, 'key' | 'metaKey' | 'ctrlKey' | 'altKey'>;

/** 1–9 pick the matching option, as in T3 Code; other keys and modified presses return null. */
export const optionShortcut = (event: ShortcutKey, count: number): number | null => {
  if (event.metaKey || event.ctrlKey || event.altKey || !/^[1-9]$/.test(event.key)) return null;
  const index = Number(event.key) - 1;
  return index < count ? index : null;
};

/** Number keys type into fields and drive menus and dialogs, so shortcuts skip those targets. */
export const ownsNumberKeys = (target: EventTarget | null) =>
  target instanceof HTMLElement &&
  !!target.closest(
    'input, textarea, select, [contenteditable]:not([contenteditable="false"]), [role="dialog"], [role="menu"], [role="listbox"]',
  );
