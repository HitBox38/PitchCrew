import { Check, MessageSquareText, Undo2 } from 'lucide-react';
import { Button } from '@pitchcrew/design-system/button';
import { Bead } from '../../components/clay/Bead';
import type { Decision } from '../hooks/useSelection';

const states = {
  waiting: { tone: 'ochre', text: 'Waiting on you.' },
  approved: { tone: 'primary', text: 'Approved. Export is authorized for these exact files.' },
  changes: {
    tone: 'plum',
    text: 'Changes requested. Writer revises from your note, then Reviewer checks again.',
  },
} as const;

/** The pinned decision. Deciding here only changes this fictional sheet. */
export const ApprovalBar = ({
  decision,
  onDecide,
}: {
  decision: Decision;
  onDecide: (next: Decision) => void;
}) => {
  const state = states[decision];
  return (
    <div className="approval" aria-live="polite">
      <p className="approval-state">
        <Bead tone={state.tone} live={decision === 'changes'} />
        {state.text}
      </p>
      <div className="approval-actions">
        {decision === 'waiting' ? (
          <>
            <Button variant="secondary" onClick={() => onDecide('changes')}>
              <MessageSquareText aria-hidden="true" />
              Request changes
            </Button>
            <Button onClick={() => onDecide('approved')}>
              <Check aria-hidden="true" />
              Approve packet
            </Button>
          </>
        ) : (
          <Button variant="secondary" onClick={() => onDecide('waiting')}>
            <Undo2 aria-hidden="true" />
            Undo
          </Button>
        )}
      </div>
    </div>
  );
};
