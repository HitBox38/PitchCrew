import { create } from 'zustand';
import type { ChatReference } from '@pitchcrew/core';

export interface ComposerPayload {
  submission?: { id: string; intent: 'queue' | 'interrupt' };
  text: string;
  references: ChatReference[];
  files: File[];
}
export interface ComposerDraft extends ComposerPayload {
  id: string;
  revision: number;
}
export interface KeptComposerDraft {
  id: string;
  payload: ComposerPayload;
  label: string;
  details?: string;
}
export interface ComposerOperation {
  token: symbol;
  payload: ComposerPayload;
  nextDraftId: string;
  kind: 'message' | 'delegation';
  hadSubmission?: boolean;
}
export interface ComposerState {
  draft: ComposerDraft;
  kept: KeptComposerDraft[];
  operation?: ComposerOperation;
  notice: string;
  refreshNeeded: boolean;
  receipt?: symbol;
  details?: string;
}
const freshDraft = (): ComposerDraft => ({
  id: crypto.randomUUID(),
  revision: 0,
  text: '',
  references: [],
  files: [],
});
export const emptyComposer: ComposerState = {
  draft: { id: 'empty', revision: 0, text: '', references: [], files: [] },
  kept: [],
  notice: '',
  refreshNeeded: false,
};
export const useComposerStore = create<{ threads: Record<string, ComposerState> }>(() => ({
  threads: {},
}));
export const composerState = (thread: string) =>
  useComposerStore.getState().threads[thread] ?? emptyComposer;
export const updateComposer = (thread: string, update: (state: ComposerState) => ComposerState) =>
  useComposerStore.setState((state) => ({
    threads: { ...state.threads, [thread]: update(state.threads[thread] ?? emptyComposer) },
  }));
export const changeComposer = (thread: string, text: string, references: ChatReference[]) =>
  updateComposer(thread, (state) => ({
    ...state,
    draft: {
      ...state.draft,
      submission:
        state.draft.text === text &&
        JSON.stringify(state.draft.references) === JSON.stringify(references)
          ? state.draft.submission
          : undefined,
      revision: state.draft.revision + 1,
      text,
      references,
    },
  }));
export const changeComposerFiles = (thread: string, files: File[]) =>
  updateComposer(thread, (state) => ({
    ...state,
    draft: {
      ...state.draft,
      submission:
        files.length === state.draft.files.length &&
        files.every((file, index) => file === state.draft.files[index])
          ? state.draft.submission
          : undefined,
      revision: state.draft.revision + 1,
      files,
    },
  }));
const hasPayload = (payload: ComposerPayload) => !!payload.text.trim() || !!payload.files.length;
const keep = (payload: ComposerPayload, label: string, details?: string): KeptComposerDraft => ({
  id: crypto.randomUUID(),
  payload,
  label: payload.submission ? 'Send not confirmed' : label,
  details,
});

/** Explicit prefills preserve the previous unsent payload as a separate draft. */
export const offerComposerDraft = (thread: string, text: string) =>
  updateComposer(thread, (state) => ({
    ...state,
    draft: { ...freshDraft(), text },
    kept: hasPayload(state.draft) ? [...state.kept, keep(state.draft, 'Kept draft')] : state.kept,
  }));
export const consumeComposerHandoff = (thread: string) => {
  try {
    const key = `pitchcrew.handoff-draft.${thread}`,
      text = sessionStorage.getItem(key);
    if (text) {
      offerComposerDraft(thread, text);
      sessionStorage.removeItem(key);
    }
  } catch {
    /* A denied handoff store must not affect an existing in-memory draft. */
  }
};

/** Atomic draft swap precedes FileReader and HTTP. Only Send is locked; editing continues. */
export const beginComposerSend = (
  thread: string,
  kind: ComposerOperation['kind'],
  intent: 'queue' | 'interrupt' = 'queue',
) => {
  let operation: ComposerOperation | undefined;
  updateComposer(thread, (state) => {
    if (state.operation) return state;
    if (kind === 'delegation' && state.draft.submission)
      return {
        ...state,
        notice:
          'This message has an unconfirmed send. Retry it or edit the message to start a new request before delegating.',
      };
    const draft = freshDraft();
    const payload = {
      ...(kind === 'message'
        ? { submission: state.draft.submission ?? { id: crypto.randomUUID(), intent } }
        : {}),
      text: state.draft.text,
      references: [...state.draft.references],
      files: kind === 'message' ? [...state.draft.files] : [],
    };
    operation = {
      token: Symbol(thread),
      payload,
      nextDraftId: draft.id,
      kind,
      hadSubmission: !!state.draft.submission,
    };
    // The delegation endpoint sends text only; selected files stay in the editable draft.
    if (kind === 'delegation') draft.files = state.draft.files;
    return {
      ...state,
      draft,
      operation,
      notice: '',
      refreshNeeded: false,
      receipt: undefined,
      details: undefined,
    };
  });
  return operation;
};
export const acceptComposerSend = (thread: string, token: symbol, refreshNeeded = false) =>
  updateComposer(thread, (state) =>
    state.operation?.token !== token
      ? state
      : {
          ...state,
          operation: undefined,
          notice: refreshNeeded
            ? 'Message accepted. Refresh the conversation to see its status.'
            : '',
          refreshNeeded,
          receipt: refreshNeeded ? token : undefined,
        },
  );
export const failComposerSend = (
  thread: string,
  token: symbol,
  details: string,
  beforePost = false,
  rejectedStatus?: number,
) =>
  updateComposer(thread, (state) => {
    const operation = state.operation;
    if (operation?.token !== token) return state;
    const rejected = rejectedStatus !== undefined && rejectedStatus >= 400 && rejectedStatus < 500;
    const conflict = rejectedStatus === 409;
    // A failed retry says nothing about whether its earlier attempt was accepted.
    // Only a fresh send can lose its identity after a definite local/server rejection.
    const originalUnconfirmed = operation.kind === 'message' && operation.hadSubmission;
    const definite = (beforePost || rejected) && !originalUnconfirmed;
    const payload = { ...operation.payload };
    if (!originalUnconfirmed && (beforePost || rejected)) delete payload.submission;
    const pristine = state.draft.id === operation.nextDraftId && state.draft.revision === 0;
    if (definite && pristine)
      return {
        ...state,
        operation: undefined,
        draft: {
          ...freshDraft(),
          ...payload,
          files: operation.kind === 'delegation' ? state.draft.files : payload.files,
        },
        notice: `Not sent: ${details}`,
        refreshNeeded: false,
        details,
      };
    return {
      ...state,
      operation: undefined,
      notice: originalUnconfirmed
        ? `Retry failed: ${details}. The original send is still unconfirmed. Refresh the conversation or retry the unchanged draft.`
        : definite
          ? `Not sent: ${details}`
          : operation.kind === 'message'
            ? 'Could not confirm the send. Your draft is kept. Retry the unchanged draft safely, or check the conversation.'
            : 'Could not confirm the send. Your drafts are kept. Review the conversation before sending it again.',
      refreshNeeded: false,
      kept: [
        ...state.kept,
        keep(
          payload,
          definite ? (conflict ? 'Send rejected' : 'Unsent message') : 'Send not confirmed',
          details,
        ),
      ],
    };
  });

/** Swap whole payloads, never splice text or offsets. The displaced active draft is kept too. */
export const swapComposerDraft = (thread: string, id: string) =>
  updateComposer(thread, (state) => {
    const selected = state.kept.find((draft) => draft.id === id);
    if (!selected || state.operation) return state;
    const kept = state.kept.filter((draft) => draft.id !== id);
    if (hasPayload(state.draft)) kept.push(keep(state.draft, 'Kept draft'));
    return {
      ...state,
      draft: { ...freshDraft(), ...selected.payload },
      kept,
      notice: '',
      refreshNeeded: false,
    };
  });

/** Explicit local discard affects only the chosen retained snapshot, never the active draft. */
export const discardComposerDraft = (thread: string, id: string) =>
  updateComposer(thread, (state) => {
    if (state.operation || !state.kept.some((draft) => draft.id === id)) return state;
    const kept = state.kept.filter((draft) => draft.id !== id);
    return {
      ...state,
      kept,
      notice: kept.length || state.refreshNeeded ? state.notice : '',
      details: kept.length ? state.details : undefined,
    };
  });
