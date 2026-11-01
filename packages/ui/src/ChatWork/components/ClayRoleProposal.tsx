import type { Role, RoleProposal } from '@pitchcrew/core';
import { ClayCapabilityChanges } from '@/ChatWork/components/ClayCapabilityChanges.tsx';
import { ClayProposalHeader } from '@/ChatWork/components/ClayProposalHeader.tsx';
import { ProposalFooter } from '@/ChatWork/components/ProposalFooter.tsx';
import { roleProposalSummary } from '@/ChatWork/summary.ts';
import type { RoleProposalsProps } from '@/ChatWork/types.ts';
import { ClayInstructionChanges } from '@/ChatWork/components/ClayInstructionChanges.tsx';
import { MessageResponse } from '@/components/ai-elements/message/components/MessageResponse.tsx';
import { noRemoteImages } from '@/components/ai-elements/message/constants.tsx';

type ClayRoleProposalProps = Pick<RoleProposalsProps, 'working' | 'act'> & {
  proposal: RoleProposal;
  current: Role;
  active: boolean;
  sourceName?: string;
};

/** A role proposal as a clay card: reason, an instruction diff and capability beads in trays. */
export const ClayRoleProposal = ({
  proposal,
  current,
  active,
  working,
  sourceName,
  act,
}: ClayRoleProposalProps) => {
  const before = proposal.beforeRole ?? current;
  const instructions = proposal.changes.instructions;
  return (
    <>
      <ClayProposalHeader
        avatar={proposal.sourceRoleId ?? current.id}
        title={
          sourceName ? `Changes to ${current.name}` : `${current.name} wants to update its role`
        }
        proposer={sourceName ?? current.name}
        createdAt={proposal.createdAt}
        summary={roleProposalSummary(proposal, before)}
      />
      <MessageResponse mode="static" components={noRemoteImages}>
        {proposal.reason}
      </MessageResponse>
      {instructions !== undefined ? (
        <section className="clay-proposal-part" aria-label="Instruction changes">
          <h5>Instructions{proposal.beforeRole ? ', compared with the reviewed version' : ''}</h5>
          <ClayInstructionChanges current={before} proposal={proposal} />
        </section>
      ) : null}
      {proposal.changes.capabilities ? (
        <section className="clay-proposal-part" aria-label="Capabilities">
          <h5>Capabilities</h5>
          <ClayCapabilityChanges current={before} changes={proposal.changes.capabilities} />
        </section>
      ) : null}
      {proposal.pipelineReviewId ? (
        <p className="clay-proposal-quiet">
          Linked pipeline review / finding {proposal.findingId}. Approval is rejected if these
          settings have changed.
        </p>
      ) : null}
      <ProposalFooter
        note={
          active
            ? `Available after ${current.name} finishes its run.`
            : 'Applied changes take effect on the next run.'
        }
        path={`/proposals/${proposal.id}/decide`}
        approveLabel="Apply changes"
        working={working}
        blocked={active}
        act={act}
      />
    </>
  );
};
