import { useEffect, type RefObject } from 'react';
import { shortcutAria, shortcutLabel } from '@/components/MarkdownEditor/shortcuts.ts';
import { isMac } from '@/shortcuts.ts';

/** Command+Enter on macOS, Control+Enter elsewhere. */
const decideKeys = ['Mod', 'Enter'] as const;
/** ARIA widgets that take typing or hold a value, as `input`, `select` and `textarea` do natively. */
const fieldRoles = [
  'combobox',
  'listbox',
  'option',
  'textbox',
  'searchbox',
  'spinbutton',
  'slider',
  'checkbox',
  'radio',
  'switch',
];
/**
 * A keystroke typed into a field belongs to the field, including an ARIA one: Base UI renders its
 * Select trigger as a `<button role="combobox">` (Tracking's Application choice) and its Checkbox
 * and Switch as buttons, which no tag name catches.
 */
const fields = [
  'input',
  'textarea',
  'select',
  '[contenteditable]:not([contenteditable="false"])',
  ...fieldRoles.map((role) => `[role="${role}"]`),
].join(', ');
/** How long a newly shown decision ignores the shortcut, so a repeated press cannot reach it. */
export const decideArmMs = 800;

/**
 * Whether a keydown presses `button`: Enter with Command (macOS) or Control and no other modifier,
 * not a held key's repeat, not a keystroke something else already used (the message box sends on
 * it) or one typed into a field, only while focus sits inside a `scope` element that contains the
 * button (a kept-mounted closed row never fires), and not within `decideArmMs` of `armedAt`.
 */
export const pressesDecide = (
  event: KeyboardEvent,
  scope: string,
  button: HTMLButtonElement | null,
  focused: Element | null,
  armedAt: number,
  now: number,
) => {
  if (event.key !== 'Enter' || event.shiftKey || event.altKey || event.repeat) return false;
  if (!(isMac ? event.metaKey : event.ctrlKey)) return false;
  if (event.defaultPrevented || event.isComposing) return false;
  const target = event.target as Partial<Element> | null;
  if (typeof target?.closest === 'function' && target.closest(fields)) return false;
  const root = focused?.closest(scope);
  if (!root || !button || !root.contains(button)) return false;
  return now - armedAt >= decideArmMs;
};

/**
 * Control/Command+Enter presses the surface's glaze verb while focus is inside `scope`
 * (`pressesDecide`): one decision per keystroke. No `scope`, no shortcut. Returns the keys as the
 * app labels them, for the verb's title, its quiet hint (`DecideHint`) and `aria-keyshortcuts`.
 */
export const useDecideShortcut = (
  button: RefObject<HTMLButtonElement | null>,
  scope: string | undefined,
  armedAt = 0,
) => {
  useEffect(() => {
    if (!scope) return;
    const keydown = (event: KeyboardEvent) => {
      const verb = button.current;
      if (!pressesDecide(event, scope, verb, document.activeElement, armedAt, performance.now()))
        return;
      event.preventDefault();
      verb?.click();
    };
    window.addEventListener('keydown', keydown);
    return () => window.removeEventListener('keydown', keydown);
  }, [button, scope, armedAt]);
  return { label: shortcutLabel(decideKeys), aria: shortcutAria(decideKeys) };
};
