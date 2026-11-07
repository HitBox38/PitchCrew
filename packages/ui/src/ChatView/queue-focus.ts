/** Keep recovery focus owned by its initiator, including temporary disabled states. */
export const runQueueRecovery = async <T>(control: HTMLElement, action: () => Promise<T>) => {
  const workspace = control.closest('.chat-workspace');
  const location = window.location.href;
  let moved = false;
  const onFocus = (event: FocusEvent) => {
    if (event.target !== control && event.target !== document.body) moved = true;
  };
  document.addEventListener('focusin', onFocus);
  const settle = () =>
    new Promise<void>((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
    );
  const restore = () => {
    if (moved || location !== window.location.href || !workspace?.isConnected) return;
    const active = document.activeElement;
    if (active !== document.body && active !== control && active?.isConnected) return;
    const usable = (element: HTMLElement | null): element is HTMLElement =>
      !!element &&
      !!element.getClientRects().length &&
      !element.matches(':disabled') &&
      !element.closest('[hidden], [inert]');
    if (control.isConnected && usable(control)) {
      if (active === document.body) control.focus({ preventScroll: true });
      return;
    }
    // One combined query returns DOM order, so express focus priority explicitly.
    [
      workspace.querySelector<HTMLElement>('.chat-stop-response:not(:disabled)'),
      workspace.querySelector<HTMLElement>('.chat-compose .chat-textarea'),
      workspace.querySelector<HTMLElement>('[data-question-answer-target]'),
    ]
      .find(usable)
      ?.focus({ preventScroll: true });
  };
  try {
    const result = await action();
    await settle();
    restore();
    return result;
  } catch (error) {
    await settle();
    restore();
    throw error;
  } finally {
    document.removeEventListener('focusin', onFocus);
  }
};
