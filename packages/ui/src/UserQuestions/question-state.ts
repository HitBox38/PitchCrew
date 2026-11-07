import { create } from 'zustand';
import type { UserInputRequest } from '@pitchcrew/core';

export type QuestionPhase = 'idle' | 'sending' | 'checking' | 'uncertain';
export type QuestionAnswerSnapshot = { text: string; selected: string[] };
export interface QuestionRecovery extends QuestionAnswerSnapshot {
  id: string;
  threadId: string;
  question: string;
  status: 'answered' | 'cancelled';
}
export interface QuestionDraft {
  threadId: string;
  text: string;
  selected: string[];
  error: string;
  phase: QuestionPhase;
  token?: symbol;
  accepted?: boolean;
  cancel?: boolean;
  notice?: string;
  submitted?: QuestionAnswerSnapshot;
  rejected?: QuestionAnswerSnapshot;
  httpRejection?: string;
}
export interface QuestionSelection {
  selectedId?: string;
  collapsedIds: string[];
}
export const emptyQuestionDraft: QuestionDraft = {
  threadId: '',
  text: '',
  selected: [],
  error: '',
  phase: 'idle',
};
export const emptyQuestionSelection: QuestionSelection = { collapsedIds: [] };
type QuestionState = {
  drafts: Record<string, QuestionDraft>;
  docks: Record<string, QuestionSelection>;
  recoveries: Record<string, QuestionRecovery>;
};
export const useQuestionState = create<QuestionState>(() => ({
  drafts: {},
  docks: {},
  recoveries: {},
}));
export const sameQuestionAnswer = (
  left: QuestionAnswerSnapshot | undefined,
  right: QuestionAnswerSnapshot | undefined,
) =>
  !!left &&
  !!right &&
  left.text.trim() === right.text.trim() &&
  left.selected.length === right.selected.length &&
  left.selected.every((id) => right.selected.includes(id));

export const pendingQuestionId = (
  questions: readonly { id: string }[],
  selection = emptyQuestionSelection,
) => {
  const collapsed = new Set(selection.collapsedIds);
  if (
    selection.selectedId &&
    !collapsed.has(selection.selectedId) &&
    questions.some((question) => question.id === selection.selectedId)
  )
    return selection.selectedId;
  return questions.find((question) => !collapsed.has(question.id))?.id;
};
export const editQuestion = (
  id: string,
  threadId: string,
  patch: Partial<Pick<QuestionDraft, 'text' | 'selected'>>,
) =>
  useQuestionState.setState((state) => ({
    drafts: {
      ...state.drafts,
      [id]: {
        ...emptyQuestionDraft,
        ...state.drafts[id],
        threadId,
        error: '',
        rejected: undefined,
        httpRejection: undefined,
        ...patch,
      },
    },
  }));
export const selectQuestion = (thread: string, id: string) =>
  useQuestionState.setState((state) => {
    const current = state.docks[thread] ?? emptyQuestionSelection;
    return {
      docks: {
        ...state.docks,
        [thread]: {
          selectedId: id,
          collapsedIds: current.collapsedIds.filter((value) => value !== id),
        },
      },
    };
  });
export const collapseQuestions = (thread: string, ids: readonly string[]) =>
  useQuestionState.setState((state) => {
    const current = state.docks[thread] ?? emptyQuestionSelection;
    return {
      docks: {
        ...state.docks,
        [thread]: {
          selectedId: ids.includes(current.selectedId ?? '') ? undefined : current.selectedId,
          collapsedIds: [...new Set([...current.collapsedIds, ...ids])],
        },
      },
    };
  });
export const beginQuestion = (
  id: string,
  threadId: string,
  cancel: boolean,
  submitted?: QuestionAnswerSnapshot,
) => {
  if ((useQuestionState.getState().drafts[id]?.phase ?? 'idle') !== 'idle') return undefined;
  if (!cancel && sameQuestionAnswer(useQuestionState.getState().drafts[id]?.rejected, submitted))
    return undefined;
  const token = Symbol(id);
  useQuestionState.setState((state) => ({
    drafts: {
      ...state.drafts,
      [id]: {
        ...emptyQuestionDraft,
        ...state.drafts[id],
        threadId,
        error: '',
        phase: 'sending',
        token,
        cancel,
        accepted: false,
        httpRejection: undefined,
        notice: undefined,
        submitted,
      },
    },
  }));
  return token;
};
export const updateQuestion = (id: string, token: symbol, patch: Partial<QuestionDraft>) =>
  useQuestionState.setState((state) => {
    const current = state.drafts[id];
    return current?.token === token
      ? { drafts: { ...state.drafts, [id]: { ...current, ...patch } } }
      : state;
  });
/** Only an authoritative resolved status removes a draft. Missing/partial snapshots retain it. */
export const reconcileQuestions = (
  questions: readonly (Pick<UserInputRequest, 'id' | 'status'> & Partial<UserInputRequest>)[] = [],
) => {
  const resolved = new Set(
    questions.filter((question) => question.status !== 'pending').map((question) => question.id),
  );
  if (!resolved.size) return;
  useQuestionState.setState((state) => {
    const recoveries = { ...state.recoveries };
    for (const question of questions) {
      const draft = state.drafts[question.id];
      if (!draft || question.status === 'pending' || (!draft.text.trim() && !draft.selected.length))
        continue;
      const owned =
        draft.accepted ||
        (draft.cancel && draft.phase !== 'idle' && question.status === 'cancelled') ||
        (draft.phase !== 'idle' &&
          !draft.cancel &&
          sameQuestionAnswer(draft.submitted, question.answer));
      if (owned) continue;
      recoveries[question.id] = {
        id: question.id,
        threadId: draft.threadId,
        question: question.question ?? 'Question',
        status: question.status,
        text: draft.text,
        selected: draft.selected.map(
          (id) => question.options?.find((option) => option.id === id)?.label ?? id,
        ),
      };
    }
    const drafts = Object.fromEntries(
      Object.entries(state.drafts).filter(([id]) => !resolved.has(id)),
    );
    const docks = Object.fromEntries(
      Object.entries(state.docks).map(([thread, value]) => [
        thread,
        {
          selectedId: resolved.has(value.selectedId ?? '') ? undefined : value.selectedId,
          collapsedIds: value.collapsedIds.filter((id) => !resolved.has(id)),
        },
      ]),
    );
    const changed =
      Object.keys(drafts).length !== Object.keys(state.drafts).length ||
      Object.entries(docks).some(
        ([thread, value]) =>
          value.selectedId !== state.docks[thread]?.selectedId ||
          value.collapsedIds.length !== state.docks[thread]?.collapsedIds.length,
      );
    return changed ? { drafts, docks, recoveries } : state;
  });
};
export const dismissQuestionRecovery = (id: string) =>
  useQuestionState.setState((state) => {
    const recoveries = { ...state.recoveries };
    delete recoveries[id];
    return { recoveries };
  });
