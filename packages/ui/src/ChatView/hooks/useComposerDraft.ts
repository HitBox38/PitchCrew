import { useEffect } from 'react';
import {
  changeComposer,
  composerState,
  consumeComposerHandoff,
  emptyComposer,
  offerComposerDraft,
  useComposerStore,
} from '../composer-state.ts';
import type { ChatReference } from '@pitchcrew/core';

export const useComposerDraft = (thread: string) => {
  const state = useComposerStore((store) => store.threads[thread] ?? emptyComposer);
  useEffect(() => consumeComposerHandoff(thread), [thread]);
  return {
    composer: state,
    draft: state.draft.text,
    draftReferences: state.draft.references,
    sending: !!state.operation,
    retryMode: state.draft.submission?.intent,
    changeDraft: (text: string, references: ChatReference[]) =>
      changeComposer(thread, text, references),
    setDraftReferences: (references: ChatReference[]) =>
      changeComposer(thread, composerState(thread).draft.text, references),
    offerDraft: offerComposerDraft,
  };
};
