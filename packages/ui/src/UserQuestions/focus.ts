const focusAvailable = (target: HTMLElement | null | undefined) => {
  if (
    !target ||
    target.matches(':disabled, [data-disabled]') ||
    target.closest('[hidden], [inert], [aria-hidden="true"]') ||
    !target.getClientRects().length
  )
    return false;
  target.focus();
  return document.activeElement === target;
};

/** Automatic handoffs always land in text entry, never a one-activation answer choice. */
export const focusQuestionAnswer = (id: string | undefined) =>
  !!id && focusAvailable(document.getElementById(`answer-${id}`));

export const focusQuestionSurface = (id: string) =>
  focusAvailable(
    document
      .getElementById(`answer-${id}`)
      ?.closest('form')
      ?.querySelector<HTMLElement>('[data-question-choice-target]'),
  );

/** A neutral conversation control never opens a software keyboard after a choice. */
export const questionReturnFocus = () =>
  [
    ...document.querySelectorAll<HTMLElement>(
      '.chat-mobile-title, .chat-heading [aria-label="Conversation options"]',
    ),
  ].find((element) => element.getClientRects().length && !element.closest('[hidden], [inert]'));

export const questionShortcutTarget = (id: string, target: EventTarget | null) => {
  if (target === document.body) return true;
  if (!(target instanceof HTMLElement)) return false;
  const answer = document.getElementById(`answer-${id}`);
  const form = answer?.closest('form') ?? null;
  return (
    questionOwnsFocus(form, target) ||
    target.closest<HTMLElement>('[data-question-id]')?.dataset.questionId === id
  );
};

/** A state update may commit after the first frame; never override a newer route or focus choice. */
export const focusAfterReveal = (destination: () => HTMLElement | null | undefined) => {
  const pathname = window.location.pathname;
  const previous = document.activeElement;
  let attempts = 0;
  const reveal = () => {
    const target = destination();
    const active = document.activeElement;
    if (
      window.location.pathname !== pathname ||
      (active !== previous && active !== document.body && active !== target)
    )
      return;
    if (focusAvailable(target)) return;
    if (++attempts < 12) requestAnimationFrame(reveal);
  };
  requestAnimationFrame(reveal);
};

/** Decisions place submit buttons outside their form using the native form association. */
export const questionOwnsFocus = (form: HTMLFormElement | null, target = document.activeElement) =>
  !!form &&
  !!target &&
  (form.contains(target) ||
    (target instanceof HTMLElement && 'form' in target && target.form === form));
