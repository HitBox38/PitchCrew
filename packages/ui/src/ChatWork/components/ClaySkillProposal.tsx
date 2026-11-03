import type { SkillProposal } from '@pitchcrew/core';
import { skillIncludedEveryRun } from '@pitchcrew/core/skill-delivery';
import { ClayProposalHeader } from '@/ChatWork/components/ClayProposalHeader.tsx';
import { ProposalFooter } from '@/ChatWork/components/ProposalFooter.tsx';
import { skillProposalSummary } from '@/ChatWork/summary.ts';
import type { SkillProposalsProps } from '@/ChatWork/types.ts';
import { SourceBlock } from '@/components/SourceBlock/index.tsx';
import { MessageResponse } from '@/components/ai-elements/message/components/MessageResponse.tsx';
import { noRemoteImages } from '@/components/ai-elements/message/constants.tsx';

type ClaySkillProposalProps = Pick<SkillProposalsProps, 'name' | 'working' | 'act'> & {
  proposal: SkillProposal;
};

/** A skill suggestion as a clay card with its exact instructions in a recessed tray. */
export const ClaySkillProposal = ({ proposal, name, working, act }: ClaySkillProposalProps) => {
  const { skill } = proposal;
  return (
    <>
      <ClayProposalHeader
        avatar={proposal.roleId}
        title={skill.name}
        proposer={name(proposal.roleId)}
        createdAt={proposal.createdAt}
        summary={skillProposalSummary(proposal, name)}
      />
      <MessageResponse mode="static" components={noRemoteImages}>
        {proposal.reason}
      </MessageResponse>
      {skill.description ? <p className="clay-proposal-quiet">{skill.description}</p> : null}
      <p className="clay-proposal-quiet">
        {skillIncludedEveryRun(skill) ? 'Included in every run' : 'Read when relevant'}
      </p>
      <section className="clay-proposal-part" aria-label="Skill instructions">
        <h5>Exact instructions</h5>
        <div className="clay-proposal-tray">
          <SourceBlock label={skill.name} value={skill.content} className="my-0" />
        </div>
        {skill.source ? (
          <p className="clay-proposal-quiet skill-source">
            From {skill.source.url}. Only Markdown instructions are included.
          </p>
        ) : null}
      </section>
      <ProposalFooter
        note="Available in new runs after you add it."
        path={`/skill-proposals/${proposal.id}/decide`}
        approveLabel="Add skill"
        working={working}
        act={act}
      />
    </>
  );
};
