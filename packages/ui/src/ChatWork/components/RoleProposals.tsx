import { useAppReducedMotion } from '@/AppMotion/hooks/useAppReducedMotion.ts';
import { AnimatePresence } from 'motion/react';
import * as m from 'motion/react-m';
import { RoleProposalContent } from '@/ChatWork/components/RoleProposalContent.tsx';
import { WorkSection } from '@/ChatWork/components/WorkSection.tsx';
import type { RoleProposalsProps } from '@/ChatWork/types.ts';
import { CircleCheck } from 'lucide-react';

export function RoleProposals({ proposals, data, working, act }: RoleProposalsProps) {
  const reduced = useAppReducedMotion();
  return (
    <WorkSection className="chat-work-section">
      <div className="chat-work-heading">
        <div>
          <h3>Proposed changes</h3>
          <p>Review how your agents want to work.</p>
        </div>
        {proposals.length ? <span className="chat-count">{proposals.length}</span> : null}
      </div>
      <AnimatePresence initial={false} mode="popLayout">
        {proposals.length ? (
          proposals.map((proposal) => {
            const current = data.roles.find((item) => item.id === proposal.roleId)!;
            const active = data.runs.some(
              (run) => run.roleId === current.id && run.status === 'running',
            );
            return (
              <m.article
                layout={reduced ? false : 'position'}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.16 }}
                className="chat-proposal"
                key={proposal.id}
                aria-label={`${current.name} proposed changes`}
              >
                <RoleProposalContent
                  proposal={proposal}
                  current={current}
                  active={active}
                  working={working}
                  act={act}
                />
              </m.article>
            );
          })
        ) : (
          <m.div
            key="empty"
            className="chat-work-empty"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.16 }}
          >
            <CircleCheck size={18} />
            <p>No changes waiting for your review.</p>
          </m.div>
        )}
      </AnimatePresence>
    </WorkSection>
  );
}
