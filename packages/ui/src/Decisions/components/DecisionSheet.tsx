import { Link } from '@tanstack/react-router';
import { FileCheck2, Globe, MessageCircleQuestion, ScrollText } from 'lucide-react';
import type { Snapshot } from '@pitchcrew/core';
import type { Action } from '@/WorkspaceStore/index.ts';
import { BrowserApprovalList } from '@/components/InboxView/components/BrowserApprovalList.tsx';
import { PacketApprovalList } from '@/components/InboxView/components/PacketApprovalList.tsx';
import { RequestStatus } from '@/components/InboxView/components/RequestStatus.tsx';
import { Button } from '@/components/ui/button/index.tsx';
import { QuestionAnswerForm } from '@/UserQuestions/components/QuestionAnswerForm.tsx';
import { decisionTitle } from '@/ClayInterface/jobs.ts';
import { BriefDecision } from './BriefDecision.tsx';
import type { Decision } from '@/ClayInterface/signals.ts';

type DecisionSheetProps = {
  decision: Decision;
  data: Snapshot;
  action: Action;
  working: boolean;
  openCard: (id: string, section?: 'application') => void;
};

const icons = {
  packet: FileCheck2,
  browser: Globe,
  question: MessageCircleQuestion,
  brief: ScrollText,
};

/** The existing approval, answer and brief controls, presented as one clay sheet. */
export const DecisionSheet = ({
  decision,
  data,
  action,
  working,
  openCard,
}: DecisionSheetProps) => {
  const card = data.cards.find((item) => item.id === decision.cardId);
  const Icon = icons[decision.kind];
  const packet = data.approvals.find((item) => item.id === decision.id);
  const browser = data.computerApprovals.find((item) => item.id === decision.id);
  const question = data.userInputs?.find((item) => item.id === decision.id);
  const act = (path: string, body?: unknown, success?: string) => {
    void action(path, 'POST', body, success).catch(() => {});
  };
  return (
    <article className="clay-decide-sheet" data-kind={decision.kind}>
      <header className="clay-decide-heading">
        <span className="clay-decide-icon" aria-hidden="true">
          <Icon size={17} />
        </span>
        <h2>{decisionTitle(decision, data)}</h2>
        {packet ? (
          <RequestStatus
            request={{ kind: 'packet', key: decision.id, approval: packet }}
            data={data}
          />
        ) : browser ? (
          <RequestStatus
            request={{ kind: 'browser', key: decision.id, approval: browser }}
            data={data}
          />
        ) : null}
        {card ? (
          <button type="button" className="clay-decide-job" onClick={() => openCard(card.id)}>
            {card.title} · {card.company}
            {card.fit !== null ? ` · Fit ${card.fit}` : ''}
          </button>
        ) : null}
      </header>
      <div className="clay-decide-body">
        {decision.kind === 'packet' && packet ? (
          <PacketApprovalList
            approvals={[packet]}
            data={data}
            onOpen={openCard}
            working={working}
            act={act}
            action={action}
          />
        ) : decision.kind === 'browser' && browser ? (
          <BrowserApprovalList computerApprovals={[browser]} action={action} working={working} />
        ) : decision.kind === 'question' && question ? (
          <>
            <QuestionAnswerForm question={question} action={action} working={working} />
            <Button
              variant="ghost"
              size="sm"
              render={<Link to="/chat/$thread" params={{ thread: question.threadId }} />}
            >
              Open the conversation
            </Button>
          </>
        ) : decision.kind === 'brief' && card ? (
          <BriefDecision card={card} openCard={openCard} />
        ) : null}
      </div>
    </article>
  );
};
