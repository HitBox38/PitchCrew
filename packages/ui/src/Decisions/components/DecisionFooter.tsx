import { Link } from '@tanstack/react-router';
import type { Approval, Card, ComputerApproval, Snapshot } from '@pitchcrew/core';
import type { Action } from '@/WorkspaceStore/index.ts';
import { BrowserDecisionFooter } from '@/components/InboxView/components/BrowserDecisionFooter.tsx';
import { PacketApprovalActions } from '@/components/InboxView/components/PacketApprovalActions.tsx';
import { Button } from '@/components/ui/button/components/Button.tsx';
import type { Decision } from '@/ClayInterface/signals.ts';
import { briefAnswersNeeded } from '../helpers.ts';

type DecisionFooterProps = {
  decision: Decision;
  data: Snapshot;
  action: Action;
  working: boolean;
  openCard: (id: string, section?: 'application') => void;
  card: Card | undefined;
  packet: Approval | undefined;
  browser: ComputerApproval | undefined;
};

/** The decision's pinned action bar. Answerable questions render theirs in QuestionSheet. */
export const DecisionFooter = (props: DecisionFooterProps) => {
  const { decision, data, action, working, openCard, card, packet, browser } = props;
  const act = (path: string, body?: unknown, success?: string) => {
    void action(path, 'POST', body, success).catch(() => {});
  };
  if (packet && card)
    return (
      <PacketApprovalActions
        approval={packet}
        card={card}
        data={data}
        action={action}
        working={working}
        onOpen={openCard}
        act={act}
      />
    );
  if (browser)
    return (
      <BrowserDecisionFooter computerApprovals={[browser]} action={action} working={working} />
    );
  if (decision.kind === 'brief' && card)
    return (
      <footer className="decide-footer" aria-label="Brief decision">
        <div className="decide-footer-bar">
          <div className="decide-actions">
            <Button onClick={() => openCard(card.id, 'application')}>
              {briefAnswersNeeded(card) ? 'Answer and confirm' : 'Review and confirm'}
            </Button>
          </div>
          <p className="decide-consequence">Writer and Reviewer only see what you confirm.</p>
        </div>
      </footer>
    );
  if (decision.kind === 'question' && decision.threadId)
    return (
      <footer className="decide-footer" aria-label="Question">
        <div className="decide-footer-bar">
          <div className="decide-actions">
            <Link className="decide-link" to="/chat/$thread" params={{ thread: decision.threadId }}>
              Open the conversation
            </Link>
          </div>
          <p className="decide-consequence">Answering continues only the agent that asked.</p>
        </div>
      </footer>
    );
  return null;
};
