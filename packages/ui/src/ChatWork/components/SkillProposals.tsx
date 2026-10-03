import { useAppReducedMotion } from '@/AppMotion/hooks/useAppReducedMotion.ts';
import { AnimatePresence } from 'motion/react';
import * as m from 'motion/react-m';
import { SkillProposalContent } from '@/ChatWork/components/SkillProposalContent.tsx';
import { WorkSection } from '@/ChatWork/components/WorkSection.tsx';
import type { SkillProposalsProps } from '@/ChatWork/types.ts';
import { CircleCheck } from 'lucide-react';

export function SkillProposals({ skillProposals, name, working, act }: SkillProposalsProps) {
  const reduced = useAppReducedMotion();
  return (
    <WorkSection className="chat-work-section">
      <div className="chat-work-heading">
        <div>
          <h3>Suggested skills</h3>
          <p>Review skills your agents recommend adding.</p>
        </div>
        {skillProposals.length ? <span className="chat-count">{skillProposals.length}</span> : null}
      </div>
      <AnimatePresence initial={false} mode="popLayout">
        {skillProposals.length ? (
          skillProposals.map((proposal) => (
            <m.article
              layout={reduced ? false : 'position'}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.16 }}
              className="chat-proposal"
              key={proposal.id}
              aria-label={`${name(proposal.roleId)} suggested ${proposal.skill.name}`}
            >
              <SkillProposalContent proposal={proposal} name={name} working={working} act={act} />
            </m.article>
          ))
        ) : (
          <m.div
            key="empty"
            className="chat-work-empty"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.16 }}
          >
            <CircleCheck size={18} />
            <p>No skills waiting for your review. Ask an agent to suggest one.</p>
          </m.div>
        )}
      </AnimatePresence>
    </WorkSection>
  );
}
