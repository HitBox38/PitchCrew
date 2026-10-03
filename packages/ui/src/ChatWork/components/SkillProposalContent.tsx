import type { SkillProposalsProps } from '@/ChatWork/types.ts';
import type { SkillProposal } from '@pitchcrew/core';
import { MessageResponse } from '@/components/ai-elements/message/components/MessageResponse.tsx';
import { noRemoteImages } from '@/components/ai-elements/message/constants.tsx';
import { RoleAvatar } from '@/components/RoleAvatar/index.tsx';
import { Button } from '@/components/ui/button/components/Button.tsx';
import { timeAgo } from '@/lib/time.ts';
import { Check, X } from 'lucide-react';

type SkillProposalContentProps = Pick<SkillProposalsProps, 'name' | 'working' | 'act'> & {
  proposal: SkillProposal;
};
export function SkillProposalContent({ proposal, name, working, act }: SkillProposalContentProps) {
  return (
    <>
      <header>
        <RoleAvatar agentRole={proposal.roleId} />
        <div>
          <h4>{proposal.skill.name}</h4>
          <time dateTime={proposal.createdAt}>
            {name(proposal.roleId)} suggested {timeAgo(proposal.createdAt)}
          </time>
        </div>
        <span className="chat-review-label">Needs your review</span>
      </header>
      <MessageResponse mode="static" components={noRemoteImages}>
        {proposal.reason}
      </MessageResponse>
      {proposal.skill.description ? <p>{proposal.skill.description}</p> : null}
      <p className="quiet">
        Assigned to:{' '}
        {proposal.skill.scope === 'all'
          ? 'All agents'
          : proposal.skill.roleIds.map(name).join(', ')}
      </p>
      {proposal.skill.source ? (
        <p className="quiet skill-source">
          From {proposal.skill.source.url}
          <br />
          Only Markdown instructions are included.
        </p>
      ) : null}
      <details>
        <summary>Review skill instructions</summary>
        <pre className="suggested-skill-content">{proposal.skill.content}</pre>
      </details>
      <footer>
        <p>Applies to new runs after you add it.</p>
        <div>
          <Button
            className="button"
            disabled={working}
            onClick={() => act(`/skill-proposals/${proposal.id}/decide`, { approved: false })}
          >
            <X size={14} /> Decline
          </Button>
          <Button
            className="button primary"
            disabled={working}
            onClick={() => act(`/skill-proposals/${proposal.id}/decide`, { approved: true })}
          >
            <Check size={14} /> Add skill
          </Button>
        </div>
      </footer>
    </>
  );
}
