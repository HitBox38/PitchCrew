import { InstructionComparison } from '@/ChatWork/components/InstructionComparison.tsx';
import type { RoleProposalsProps } from '@/ChatWork/types.ts';
import type { RoleProposal, Role } from '@pitchcrew/core';
import { MessageResponse } from '@/components/ai-elements/message/components/MessageResponse.tsx';
import { noRemoteImages } from '@/components/ai-elements/message/constants.tsx';
import { RoleAvatar } from '@/components/RoleAvatar/index.tsx';
import { Button } from '@/components/ui/button/components/Button.tsx';
import { timeAgo } from '@/lib/time.ts';
import { Check, X } from 'lucide-react';
import { CapabilityChanges } from './CapabilityChanges.tsx';

type RoleProposalContentProps = Pick<RoleProposalsProps, 'working' | 'act'> & {
  proposal: RoleProposal;
  current: Role;
  active: boolean;
  sourceName?: string;
};
export function RoleProposalContent({
  proposal,
  current,
  active,
  working,
  sourceName,
  act,
}: RoleProposalContentProps) {
  return (
    <>
      <header>
        <RoleAvatar agentRole={current.id} />
        <div>
          <h4>
            {sourceName
              ? `${sourceName} proposes changes to ${current.name}`
              : `${current.name} wants to update its role`}
          </h4>
          <time dateTime={proposal.createdAt}>{timeAgo(proposal.createdAt)}</time>
        </div>
        <span className="chat-review-label">Needs your review</span>
      </header>
      <MessageResponse mode="static" components={noRemoteImages}>
        {proposal.reason}
      </MessageResponse>
      {proposal.changes.instructions !== undefined ? (
        <details>
          <summary>Compare role instructions</summary>
          <InstructionComparison current={proposal.beforeRole ?? current} proposal={proposal} />
        </details>
      ) : null}
      {proposal.changes.capabilities ? (
        <CapabilityChanges
          current={proposal.beforeRole ?? current}
          changes={proposal.changes.capabilities}
        />
      ) : null}
      {proposal.pipelineReviewId ? (
        <p>
          Linked pipeline review / finding {proposal.findingId}. Approval is rejected if these
          settings have changed.
        </p>
      ) : null}
      <footer>
        <p>
          {active
            ? `Available after ${current.name} finishes its run.`
            : 'Applied changes take effect on the next run.'}
        </p>
        <div>
          <Button
            className="button"
            disabled={working}
            onClick={() => act(`/proposals/${proposal.id}/decide`, { approved: false })}
          >
            <X size={14} /> Decline
          </Button>
          <Button
            className="button primary"
            disabled={working || active}
            onClick={() => act(`/proposals/${proposal.id}/decide`, { approved: true })}
          >
            <Check size={14} /> Apply changes
          </Button>
        </div>
      </footer>
    </>
  );
}
