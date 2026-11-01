import type { Snapshot } from '@pitchcrew/core';
import { RoleAvatar } from '@/components/RoleAvatar/index.tsx';
import { decisionTitle } from '@/ClayInterface/jobs.ts';
import type { Decision } from '@/ClayInterface/signals.ts';

type DecisionPeekProps = {
  next: Decision | undefined;
  data: Snapshot;
  select: (id: string) => void;
};

/** The next waiting decision, peeking out from under the current sheet. */
export const DecisionPeek = ({ next, data, select }: DecisionPeekProps) => {
  if (!next) return null;
  const card = data.cards.find((item) => item.id === next.cardId);
  return (
    <button type="button" className="decide-peek" onClick={() => select(next.id)}>
      {next.roleId ? <RoleAvatar agentRole={next.roleId} size="small" /> : null}
      <strong>{card?.company ?? 'Conversation'}</strong>
      <span>{decisionTitle(next, data)}</span>
      <small>Next</small>
    </button>
  );
};
