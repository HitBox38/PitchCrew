import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@pitchcrew/design-system/dialog';
import type { KeptComposerDraft } from '../composer-state.ts';
import {
  composerEditorFocus,
  composerRecoveryReturnFocus,
  discardKeptComposerDraft,
} from '../composer-recovery.ts';
import { ComposerKeptDraft } from './ComposerKeptDraft.tsx';
import { useEffect, useRef, type RefObject } from 'react';
import { focusAfterReveal } from '@/UserQuestions/focus.ts';

export const ComposerDraftDialog = ({
  thread,
  open,
  onOpenChange,
  drafts,
  disabled,
  restore,
  trigger,
}: {
  thread: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  drafts: KeptComposerDraft[];
  disabled: boolean;
  restore: (id: string) => void;
  trigger: RefObject<HTMLButtonElement | null>;
}) => {
  const usingDraft = useRef(false);
  const origin = useRef('');
  useEffect(() => {
    if (open) {
      usingDraft.current = false;
      origin.current = window.location.pathname;
    }
  }, [open]);
  const destination = () =>
    (usingDraft.current ? composerEditorFocus() : undefined) ??
    composerRecoveryReturnFocus(trigger.current);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="chat-draft-recovery"
        style={{ maxHeight: '80dvh', overflowY: 'auto' }}
        finalFocus={() => {
          if (origin.current !== window.location.pathname) return false;
          const target = destination();
          if (target) return target;
          focusAfterReveal(destination);
          return false;
        }}
      >
        <DialogHeader>
          <DialogTitle data-kept-draft-heading="" tabIndex={-1}>
            Kept message drafts
          </DialogTitle>
          <DialogDescription>
            Using a draft keeps your current text, references and files as another draft. Nothing
            sends from this review.
          </DialogDescription>
        </DialogHeader>
        {!drafts.length ? (
          <p>No kept drafts.</p>
        ) : (
          drafts.map((draft) => (
            <ComposerKeptDraft
              key={draft.id}
              draft={draft}
              disabled={disabled}
              useDraft={() => {
                usingDraft.current = true;
                restore(draft.id);
              }}
              discardDraft={(control) => discardKeptComposerDraft(thread, draft.id, control)}
            />
          ))
        )}
      </DialogContent>
    </Dialog>
  );
};
