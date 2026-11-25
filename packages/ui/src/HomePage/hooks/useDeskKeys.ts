import { useCallback, type KeyboardEvent } from 'react';
import { typing } from '@/shortcuts.ts';

const steps: Record<string, 1 | -1> = { ArrowDown: 1, j: 1, ArrowUp: -1, k: -1 };
const rowKeys = new Set(['ArrowDown', 'ArrowUp', 'Home', 'End']);
// Open popups that take letters. `useDeskFocus` lists overlay and backdrop slots too, among the
// surfaces that may hold focus; whether j and k reach the desk needs only an open popup's role.
const overlays = '[role="dialog"], [role="alertdialog"], [role="menu"], [role="listbox"]';

/** Row triggers a reader can see: rows inside a closed fold or a hidden panel stay mounted but skip. */
const visibleTriggers = (desk: HTMLElement) =>
  [...desk.querySelectorAll<HTMLElement>('[data-needs-trigger]')].filter(
    (trigger) => !trigger.closest('[hidden]') && trigger.getClientRects().length > 0,
  );

/**
 * The desk's own row keys (Base UI's accordion has none): ArrowDown and ArrowUp move between row
 * triggers and wrap, Home and End go to the ends, while focus is on a trigger; j and k do the same
 * from anywhere inside the desk except while typing, with a modifier, or while a dialog or menu is
 * open. Bound to the desk, never the window, so single keys work only with focus inside it.
 * Moving focus never opens or decides anything.
 */
export const useDeskKeys = () =>
  useCallback((event: KeyboardEvent<HTMLElement>) => {
    if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
    if (event.defaultPrevented || event.nativeEvent.isComposing) return;
    const desk = event.currentTarget;
    const target = event.target as HTMLElement;
    // Portaled menus and dialogs bubble through React; only keys pressed in the desk count.
    if (!desk.contains(target)) return;
    const onTrigger = target.matches('[data-needs-trigger]');
    const letter = event.key === 'j' || event.key === 'k';
    if (letter) {
      if (typing(target) || document.querySelector(overlays)) return;
    } else if (!onTrigger || !rowKeys.has(event.key)) return;
    const triggers = visibleTriggers(desk);
    if (!triggers.length) return;
    const own = target
      .closest('[data-needs-key]')
      ?.querySelector<HTMLElement>('[data-needs-trigger]');
    const here = triggers.indexOf(onTrigger ? target : (own ?? target));
    const step = steps[event.key];
    const index =
      event.key === 'Home' || (step === 1 && here < 0)
        ? 0
        : event.key === 'End' || (step === -1 && here < 0)
          ? triggers.length - 1
          : (here + (step ?? 0) + triggers.length) % triggers.length;
    event.preventDefault();
    triggers[index]?.focus();
  }, []);
