import { useState } from 'react';
import { Button } from '@/components/ui/button/components/Button.tsx';
import type { Approval, Card } from '@pitchcrew/core';
import type { Action } from '@/WorkspaceStore/index.ts';
export const ManualSubmissionCompletion = ({
  approval,
  card,
  active,
  action,
  working,
}: {
  approval: Approval;
  card: Card;
  active: boolean;
  action: Action;
  working: boolean;
}) => {
  const [error, setError] = useState('');
  if (card.state !== 'awaiting_approval') return null;
  return (
    <div className="flex flex-wrap items-center gap-2 py-3">
      <p className="quiet">Finished this application yourself?</p>
      <Button
        size="sm"
        variant="outline"
        disabled={working}
        onClick={() => {
          setError('');
          const path = active
            ? `/conversations/${approval.submission!.threadId}/stop`
            : `/approvals/${approval.id}/complete`;
          void action(
            path,
            'POST',
            active ? {} : { state: 'submitted' },
            active
              ? 'Preparation stopped; record submission after it settles.'
              : 'Recorded your manual submission',
          ).catch((reason: unknown) => setError(String(reason)));
        }}
      >
        {active ? 'Stop preparation to record submission' : 'I’ve submitted manually'}
      </Button>
      {error ? (
        <p className="form-error" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
};
