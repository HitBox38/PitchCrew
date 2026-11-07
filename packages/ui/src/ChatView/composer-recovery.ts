import { discardComposerDraft, updateComposer } from './composer-state.ts';
import { questionReturnFocus } from '@/UserQuestions/focus.ts';

const available = (element: HTMLElement | null | undefined): element is HTMLElement =>
  !!element?.isConnected &&
  !!element.getClientRects().length &&
  !element.matches(':disabled,[data-disabled]') &&
  !element.closest('[hidden],[inert],[aria-hidden="true"]') &&
  getComputedStyle(element).visibility === 'visible';

/** Closing a discarded draft chooses a visible neutral surface, never a hidden editor or keyboard. */
export const composerRecoveryReturnFocus = (trigger?: HTMLElement | null) =>
  [
    trigger,
    ...document.querySelectorAll<HTMLElement>('.pending-question-trigger'),
    ...document.querySelectorAll<HTMLElement>('[data-question-choice-target]'),
    questionReturnFocus(),
    ...document.querySelectorAll<HTMLElement>('.chat-compose'),
  ].find(available);

export const composerEditorFocus = () =>
  [
    ...document.querySelectorAll<HTMLElement>('.browser-reply-input, .chat-compose .chat-textarea'),
  ].find(available);

/** The removed card's owner moves to the next action or the empty dialog heading, not body. */
export const discardKeptComposerDraft = (thread: string, id: string, control: HTMLElement) => {
  const dialog = control.closest<HTMLElement>('[role="dialog"]'),
    path = window.location.pathname;
  const rows = [...(dialog?.querySelectorAll('.chat-kept-draft') ?? [])];
  const index = rows.findIndex((row) => row.contains(control)),
    owned = document.activeElement === control;
  discardComposerDraft(thread, id);
  if (!owned || !dialog) return;
  let moved = false;
  const intent = () => {
    moved = true;
  };
  document.addEventListener('pointerdown', intent, true);
  document.addEventListener('keydown', intent, true);
  requestAnimationFrame(() =>
    requestAnimationFrame(() => {
      document.removeEventListener('pointerdown', intent, true);
      document.removeEventListener('keydown', intent, true);
      if (moved || window.location.pathname !== path || !dialog.isConnected || control.isConnected)
        return;
      const actions = [...dialog.querySelectorAll<HTMLElement>('[data-kept-draft-use]')];
      (
        actions[Math.min(index, actions.length - 1)] ??
        dialog.querySelector<HTMLElement>('[data-kept-draft-heading]')
      )?.focus();
    }),
  );
};

/** Refresh is read-only and cannot acknowledge a newer request using an older receipt. */
export const refreshComposerReceipt = async (
  thread: string,
  receipt: symbol | undefined,
  reload: () => Promise<void>,
) => {
  await reload();
  if (receipt)
    updateComposer(thread, (current) =>
      current.receipt !== receipt
        ? current
        : {
            ...current,
            notice: '',
            refreshNeeded: false,
            receipt: undefined,
          },
    );
};
