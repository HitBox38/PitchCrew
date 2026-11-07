import { useRef, useState } from 'react';
import { Button } from '@pitchcrew/design-system/button';
import { emptyComposer, swapComposerDraft, useComposerStore } from '../composer-state.ts';
import { useWorkspaceStore } from '@/WorkspaceStore/index.ts';
import { ComposerDraftDialog } from './ComposerDraftDialog.tsx';
import { QueueDiagnostics } from './QueueDiagnostics.tsx';
import { focusAfterReveal } from '@/UserQuestions/focus.ts';
import { composerEditorFocus, refreshComposerReceipt } from '../composer-recovery.ts';

export const ComposerRecovery = ({ thread }: { thread: string }) => {
  const state = useComposerStore((store) => store.threads[thread] ?? emptyComposer);
  const [open, setOpen] = useState(false),
    [checking, setChecking] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  if (!state.notice && !state.refreshNeeded && !state.kept.length && !open) return null;
  const refresh = async () => {
    const receipt = state.receipt;
    setChecking(true);
    try {
      await refreshComposerReceipt(thread, receipt, useWorkspaceStore.getState().reload);
    } catch {
      /* The workspace retains its connection state; no POST or duplicate toast. */
    } finally {
      setChecking(false);
    }
  };
  const restore = (id: string) => {
    swapComposerDraft(thread, id);
    setOpen(false);
    focusAfterReveal(composerEditorFocus);
  };
  return (
    <div className="chat-composer-recovery">
      {state.notice ? <p>{state.notice}</p> : null}
      {state.kept.length ? (
        <Button ref={trigger} variant="ghost" size="sm" onClick={() => setOpen(true)}>
          Review {state.kept.length} kept {state.kept.length === 1 ? 'draft' : 'drafts'}
        </Button>
      ) : null}
      {state.refreshNeeded || state.kept.some((draft) => draft.payload.submission) ? (
        <Button variant="ghost" size="sm" disabled={checking} onClick={() => void refresh()}>
          {checking ? 'Refreshing…' : 'Refresh conversation'}
        </Button>
      ) : null}
      {state.details && !state.kept.length ? (
        <QueueDiagnostics entries={[{ label: 'Send details', text: state.details }]} />
      ) : null}
      <ComposerDraftDialog
        thread={thread}
        open={open}
        onOpenChange={setOpen}
        drafts={state.kept}
        disabled={!!state.operation}
        restore={restore}
        trigger={trigger}
      />
    </div>
  );
};
