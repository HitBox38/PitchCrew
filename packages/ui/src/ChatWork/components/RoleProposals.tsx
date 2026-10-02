import { InstructionComparison } from '@/ChatWork/components/InstructionComparison.tsx';
import type { RoleProposalsProps } from '@/ChatWork/types.ts';
import { MessageResponse } from '@/components/ai-elements/message/components/MessageResponse.tsx';
import { noRemoteImages } from '@/components/ai-elements/message/constants.tsx';
import { RoleAvatar } from '@/components/RoleAvatar/index.tsx';
import { Button } from '@/components/ui/button/components/Button.tsx';
import { timeAgo } from '@/lib/time.ts';
import { Check, CircleCheck, X } from 'lucide-react';
import { CapabilityChanges } from './CapabilityChanges.tsx';

export function RoleProposals({ proposals, data, working, act }: RoleProposalsProps) {
  return (
    <section className="chat-work-section">
      <div className="chat-work-heading">
        <div>
          <h3>Proposed changes</h3>
          <p>Review how your agents want to work.</p>
        </div>
        {proposals.length ? <span className="chat-count">{proposals.length}</span> : null}
      </div>
      {proposals.length ? (
        proposals.map((proposal) => {
          const current = data.roles.find((item) => item.id === proposal.roleId)!;
          const active = data.runs.some(
            (run) => run.roleId === current.id && run.status === 'running',
          );
          return (
            <article
              className="chat-proposal"
              key={proposal.id}
              aria-label={`${current.name} proposed changes`}
            >
              <header>
                <RoleAvatar agentRole={current.id} />
                <div>
                  <h4>{current.name} wants to update its role</h4>
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
                  <InstructionComparison current={current} proposal={proposal} />
                </details>
              ) : null}
              {proposal.changes.capabilities ? (
                <CapabilityChanges current={current} changes={proposal.changes.capabilities} />
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
            </article>
          );
        })
      ) : (
        <div className="chat-work-empty">
          <CircleCheck size={18} />
          <p>No changes waiting for your review.</p>
        </div>
      )}
    </section>
  );
}
