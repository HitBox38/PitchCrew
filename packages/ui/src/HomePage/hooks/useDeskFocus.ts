import { useEffect, useMemo, useRef, type RefObject } from 'react';
import { useWorkspaceStore } from '@/WorkspaceStore/index.ts';
import { deskScope } from '../constants.ts';
import { deskRecords } from '../records.ts';

/** Surfaces that own focus while open: dialogs, sheets, menus, select lists and their backdrops. */
const overlays =
  '[role="dialog"], [role="alertdialog"], [role="menu"], [role="listbox"], [data-slot$="overlay"], [data-slot$="backdrop"]';
const triggerOf = (root: HTMLElement, key: string) =>
  [...root.querySelectorAll<HTMLElement>('[data-needs-trigger]')].find(
    (trigger) => trigger.dataset.needsTrigger === key,
  );
/** Calls `then` once job details has left the page (its exit can take a few frames). */
const whenSheetCloses = (then: () => void, frames = 60) =>
  requestAnimationFrame(() => {
    if (frames > 0 && document.querySelector('.card-details-panel'))
      whenSheetCloses(then, frames - 1);
    else requestAnimationFrame(then);
  });

/**
 * Focus after the desk's own decisions, dialogs and sheets. Base UI returns focus to the last
 * element still on the page when its opener is gone, which can be a sidebar link, so once a desk
 * call settles or job details opened from the desk closes, the open row's trigger (or the close
 * line) takes focus a frame later, without scrolling, unless the user moved focus elsewhere
 * meanwhile or another dialog, sheet or menu holds it.
 */
export const useDeskFocus = (tray: RefObject<HTMLElement | null>, reduced: boolean) => {
  const moved = useRef(false);
  const fromDesk = useRef(false);
  const openCard = useWorkspaceStore((state) => state.openCard);
  const focus = useMemo(() => {
    /** After the open transition, brings the open row into view if its verbs are off screen. */
    const reveal = (root: HTMLElement) =>
      window.setTimeout(() => {
        const row = root.querySelector<HTMLElement>(deskScope);
        const scroller = root.closest<HTMLElement>('.workspace-body');
        if (!row || !scroller) return;
        const box = row.getBoundingClientRect();
        const view = scroller.getBoundingClientRect();
        if (box.top < view.top || box.bottom > view.bottom)
          row.scrollIntoView({ block: 'nearest', behavior: reduced ? 'auto' : 'smooth' });
      }, 220);
    const open = () => {
      const root = tray.current;
      const target =
        root?.querySelector<HTMLElement>(`${deskScope} [data-needs-trigger]`) ??
        root?.querySelector<HTMLElement>('[data-needs-end]');
      if (!root || !target) return;
      target.focus({ preventScroll: true });
      reveal(root);
    };
    /** A desk call settled; `advanced` when its row left and the next one opened. */
    const settle = (advanced: boolean) =>
      requestAnimationFrame(() => {
        const root = tray.current;
        const active = document.activeElement;
        if (moved.current || !root) return;
        const held = active && active !== document.body ? active : null;
        if (held?.closest(overlays)) return;
        if (!advanced && held && root.contains(held)) return;
        open();
      });
    /** A row unmounted while it held focus (it was decided, resolved or moved to another tier). */
    const lost = (key: string) =>
      requestAnimationFrame(() => {
        const root = tray.current;
        if (!root || (document.activeElement && document.activeElement !== document.body)) return;
        const trigger = triggerOf(root, key);
        if (trigger) trigger.focus({ preventScroll: true });
        else open();
      });
    /** Opens job details from the desk; focus comes back to the desk when it closes. */
    const openJob = (id: string, section?: 'job' | 'application' | 'activity') => {
      fromDesk.current = true;
      openCard(id, section);
    };
    /** Focuses one row's trigger, bringing it into view (a link from elsewhere on Home). */
    const row = (key: string) => {
      const root = tray.current;
      if (root) triggerOf(root, key)?.focus();
    };
    return { settle, lost, openJob, open, row };
  }, [tray, reduced, openCard]);
  useEffect(() => {
    // The user's own last press decides whether focus may be moved for them.
    const press = (event: Event) => {
      const target = event.target instanceof Element ? event.target : null;
      const root = tray.current;
      if (!target || !root) return;
      if (root.contains(target)) moved.current = false;
      else if (!target.closest(overlays)) moved.current = true;
    };
    document.addEventListener('pointerdown', press, true);
    document.addEventListener('keydown', press, true);
    const stop = useWorkspaceStore.subscribe((state, previous) => {
      if (!previous.selectedId || state.selectedId || !fromDesk.current) return;
      fromDesk.current = false;
      deskRecords.release();
      whenSheetCloses(() => focus.settle(false));
    });
    return () => {
      document.removeEventListener('pointerdown', press, true);
      document.removeEventListener('keydown', press, true);
      stop();
    };
  }, [tray, focus]);
  return focus;
};
