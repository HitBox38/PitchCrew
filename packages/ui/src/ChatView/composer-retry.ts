type SendMode = 'queue' | 'interrupt';
export interface ComposerRetryMode {
  retryMode?: SendMode;
}

export const effectiveComposerMode = (preferred: SendMode, retryMode?: SendMode) =>
  retryMode ?? preferred;

/** Every submit surface and shortcut uses the retained send's exact original action. */
export const composerSubmitMode = (
  { busy, sendMode, retryMode }: ComposerRetryMode & { busy: boolean; sendMode: SendMode },
  alternate = false,
): SendMode =>
  retryMode ??
  (busy ? (alternate ? (sendMode === 'queue' ? 'interrupt' : 'queue') : sendMode) : 'queue');

export const composerRetryLabel = (mode: SendMode) =>
  mode === 'interrupt' ? 'Retry original interrupt send' : 'Retry original queued send';

export const composerRetryNote = (mode?: SendMode) =>
  mode === 'interrupt'
    ? 'Retry keeps the original Interrupt action. If not already saved, it stops current work, cancels pending questions and resumes the queue to send.'
    : mode === 'queue'
      ? 'Retry keeps the original Queue action. If already saved, it will not send again.'
      : '';
