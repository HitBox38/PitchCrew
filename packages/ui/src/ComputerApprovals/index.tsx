import { useAppReducedMotion } from '@/AppMotion/hooks/useAppReducedMotion.ts';
import { AnimatePresence } from 'motion/react';
import * as m from 'motion/react-m';
import { BrowserApprovalContent } from './components/BrowserApprovalContent.tsx';
import type { ComputerApprovalsProps } from './types.ts';

export function ComputerApprovals({ approvals, action, working }: ComputerApprovalsProps) {
  const reduced = useAppReducedMotion();
  return (
    <AnimatePresence initial={false}>
      {approvals.map((approval) => (
        <m.section
          className="approval-card"
          key={approval.id}
          layout={reduced ? false : 'position'}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, pointerEvents: 'none' }}
          transition={{ duration: 0.16 }}
        >
          <BrowserApprovalContent approval={approval} action={action} working={working} />
        </m.section>
      ))}
    </AnimatePresence>
  );
}
