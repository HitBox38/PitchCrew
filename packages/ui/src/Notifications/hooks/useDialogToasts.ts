import { useEffect, useRef } from 'react';
import { useToastManager } from '@pitchcrew/design-system/toast';
import { toastPlacement } from '../dialog-placement.ts';

const modalSelector =
  "[role='dialog']:is([data-slot='dialog-content'], [data-slot='sheet-content']):not([data-mobile]), [role='alertdialog']";
const footerSelector = "footer, [data-slot$='footer'], .ui-footer-bar, .profile-import-footer";
/** A review shown inside an already open dialog (Profile sources) counts as a newly opened one. */
const dialogState = (dialog: HTMLElement) => (dialog.hasAttribute('data-review') ? 'review' : '');
const readyToReview = /ready to review/i;

/** The dialog's pinned footers: those reaching its bottom edge. */
const pinnedFooters = (dialog: HTMLElement, bottom: number) =>
  [...dialog.querySelectorAll<HTMLElement>(footerSelector)].filter((footer) => {
    const box = footer.getBoundingClientRect();
    return box.height && box.bottom >= bottom - 24;
  });

type Manager = ReturnType<typeof useToastManager>;
const transient = (manager: Manager) =>
  manager.toasts.filter(
    (toast) => !toast.data && (toast.type === 'success' || toast.type === 'info'),
  );

/**
 * Keeps toasts off open modal dialogs: a newly opened dialog (or a review opening inside one)
 * dismisses earlier transient confirmations, “ready to review” never shows over the review it
 * announces, and while a dialog is open the stack moves outside its bounds or 16px above the real
 * top of its footer, following the footer as it grows. Errors and crew notices stay.
 */
export const useDialogToasts = () => {
  const manager = useToastManager();
  const current = useRef(manager);
  useEffect(() => {
    current.current = manager;
  });
  useEffect(() => {
    const root = document.documentElement;
    const seen = new WeakMap<Element, string>();
    let frame = 0;
    let observed: HTMLElement[] = [];
    const schedule = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(place);
    };
    const resize = new ResizeObserver(schedule);
    const observe = (elements: HTMLElement[]) => {
      if (elements.length === observed.length && elements.every((e, i) => e === observed[i]))
        return;
      resize.disconnect();
      elements.forEach((element) => resize.observe(element));
      observed = elements;
    };
    const place = () => {
      const dialogs = [...document.querySelectorAll<HTMLElement>(modalSelector)].filter(
        (dialog) => dialog.getClientRects().length,
      );
      const toasts = transient(current.current);
      if (dialogs.some((dialog) => seen.get(dialog) !== dialogState(dialog)))
        toasts.forEach((toast) => current.current.close(toast.id));
      else if (dialogs.some((dialog) => dialogState(dialog) === 'review'))
        toasts
          .filter((toast) => readyToReview.test(String(toast.title ?? '')))
          .forEach((toast) => current.current.close(toast.id));
      dialogs.forEach((dialog) => seen.set(dialog, dialogState(dialog)));
      const dialog = dialogs.at(-1);
      if (!dialog) {
        observe([]);
        delete root.dataset.toastSide;
        root.style.removeProperty('--toast-inset-bottom');
        return;
      }
      const box = dialog.getBoundingClientRect();
      const footers = pinnedFooters(dialog, box.bottom);
      observe([dialog, ...footers]);
      const tops = footers.map((footer) => footer.getBoundingClientRect().top);
      const viewport = { width: window.innerWidth, height: window.innerHeight };
      const width = Math.min(360, viewport.width - 32);
      const footerTop = tops.length ? Math.min(...tops) : null;
      const placement = toastPlacement(box, footerTop, viewport, width);
      root.dataset.toastSide = placement.side;
      root.style.setProperty('--toast-inset-bottom', `${placement.bottom}px`);
    };
    const observer = new MutationObserver(schedule);
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributeFilter: ['data-open', 'data-starting-style', 'data-ending-style', 'data-review'],
    });
    window.addEventListener('resize', schedule);
    schedule();
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      resize.disconnect();
      window.removeEventListener('resize', schedule);
      delete root.dataset.toastSide;
      root.style.removeProperty('--toast-inset-bottom');
    };
  }, []);
};
