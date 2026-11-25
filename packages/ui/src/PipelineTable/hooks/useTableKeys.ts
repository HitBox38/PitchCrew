import { useCallback, useEffect, useLayoutEffect, useRef, type RefObject } from 'react';
import { typing } from '@/shortcuts.ts';
import { useWorkspaceStore } from '@/WorkspaceStore/index.ts';
import type { TableModel } from './usePipelineTable.ts';

/** Surfaces that own their keys and focus while open: dialogs, sheets, menus and select lists. */
const overlays = '[role="dialog"], [role="alertdialog"], [role="menu"], [role="listbox"]';

/** Calls `then` once job details has left the page (its exit can take a few frames). */
const whenSheetCloses = (then: () => void, frames = 60) =>
  requestAnimationFrame(() => {
    if (frames > 0 && document.querySelector('.card-details-panel'))
      whenSheetCloses(then, frames - 1);
    else requestAnimationFrame(then);
  });

const rowButtons = (tray: HTMLElement | null) => [
  ...(tray?.querySelectorAll<HTMLElement>('[data-table-open]') ?? []),
];

/** Focuses a row's button without scrolling, then brings its whole row into view. */
const focusRow = (button: HTMLElement | undefined) => {
  if (!button) return;
  button.focus({ preventScroll: true });
  (button.closest('[data-table-row]') ?? button).scrollIntoView({ block: 'nearest' });
};

/**
 * The table's keys, listened for on its region (never the window), so single letters work only
 * while focus is inside it: j/k and the arrows move between rows (the arrows only among the rows),
 * x selects the focused row, / goes to Search jobs and Escape clears the selection. Keys typed in a
 * field, with ⌘, Ctrl or Alt, on a select or inside a menu or dialog are left alone, and so are
 * Shift with an arrow or Escape (Shift+j and Shift+x are other letters; / needs Shift on some
 * layouts). Holding j, k or an arrow keeps walking; a held x, Escape or / acts once. Job details
 * opened from a row hands focus back to that row when it closes.
 */
export const useTableKeys = (
  model: TableModel,
  tray: RefObject<HTMLElement | null>,
  region: RefObject<HTMLElement | null>,
  openCard: (id: string) => void,
) => {
  const opened = useRef<string | null>(null);
  useEffect(
    () =>
      useWorkspaceStore.subscribe((state, previous) => {
        const id = opened.current;
        if (!id || !previous.selectedId || state.selectedId) return;
        opened.current = null;
        whenSheetCloses(() => {
          const active = document.activeElement;
          if (!tray.current || tray.current.contains(active) || active?.closest(overlays)) return;
          const buttons = rowButtons(tray.current);
          focusRow(buttons.find((button) => button.dataset.tableOpen === id) ?? buttons[0]);
        });
      }),
    [tray],
  );
  const open = useCallback(
    (id: string) => {
      opened.current = id;
      openCard(id);
    },
    [openCard],
  );
  const onKeyDown = (event: KeyboardEvent) => {
    if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey) return;
    const target = event.target instanceof HTMLElement ? event.target : null;
    if (!target || typing(target) || target.closest(overlays)) return;
    // A select trigger keeps its own keys: it types ahead through its options.
    if (target.closest('[data-slot="select-trigger"]')) return;
    const arrow = event.key === 'ArrowDown' || event.key === 'ArrowUp';
    if (event.shiftKey && (arrow || event.key === 'Escape')) return;
    // A toggle on every auto-repeat would leave a held key's result to the repeat rate.
    if (event.repeat && (event.key === 'x' || event.key === 'Escape' || event.key === '/')) return;
    if (event.key === 'Escape') {
      if (!model.selected.length) return;
      event.preventDefault();
      model.clear();
      return;
    }
    if (event.key === '/') {
      event.preventDefault();
      document.querySelector<HTMLElement>('.board-search input')?.focus();
      return;
    }
    const root = tray.current;
    if (!root || (arrow && !root.contains(target))) return;
    const buttons = rowButtons(root);
    const index = buttons.findIndex((button) =>
      button.closest('[data-table-row]')?.contains(target),
    );
    const move = (step: number) => {
      const next = buttons[index < 0 ? 0 : Math.min(buttons.length - 1, Math.max(0, index + step))];
      if (!next) return;
      event.preventDefault();
      focusRow(next);
    };
    if (event.key === 'j' || event.key === 'ArrowDown') move(1);
    else if (event.key === 'k' || event.key === 'ArrowUp') move(-1);
    else if (event.key === 'x' && model.selectable && buttons[index]) {
      event.preventDefault();
      model.toggle(buttons[index].dataset.tableOpen!);
    }
  };
  // The region is a section, not a control, so its keys are a listener on it reading the latest
  // model rather than a JSX handler.
  const latest = useRef(onKeyDown);
  useLayoutEffect(() => {
    latest.current = onKeyDown;
  });
  useEffect(() => {
    const root = region.current;
    if (!root) return;
    const listen = (event: KeyboardEvent) => latest.current(event);
    root.addEventListener('keydown', listen);
    return () => root.removeEventListener('keydown', listen);
  }, [region]);
  return { open };
};
