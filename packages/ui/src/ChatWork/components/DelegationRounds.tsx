import { delegationRoundLifecycle } from '@pitchcrew/core/lifecycles';
import { WorkSection } from '@/ChatWork/components/WorkSection.tsx';
import { DelegationRoundCard } from '@/ChatWork/components/DelegationRoundCard.tsx';
import type { DelegationRoundsProps } from '@/ChatWork/types.ts';
import { Users } from 'lucide-react';

export const DelegationRounds = (props: DelegationRoundsProps) => {
  const { rounds } = props;
  if (!rounds.length) return null;
  const open = rounds.filter((round) => !delegationRoundLifecycle.is('settled', round.status));
  return (
    <WorkSection className="chat-work-section">
      <div className="chat-work-heading">
        <div>
          <h3>
            Delegation rounds
            {open.length ? (
              <span className="chat-count" data-tone="quiet">
                {open.length}
              </span>
            ) : null}
          </h3>
          <p>A lead asked several agents at once and collects every result in one turn.</p>
        </div>
        <Users size={18} />
      </div>
      <ol className="chat-round-list">
        {rounds.map((round) => (
          <DelegationRoundCard key={round.id} round={round} {...props} />
        ))}
      </ol>
    </WorkSection>
  );
};
