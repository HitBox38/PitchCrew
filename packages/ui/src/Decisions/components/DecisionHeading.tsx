import { FileCheck2, Globe, MessageCircleQuestion, ScrollText } from 'lucide-react';
import type { Approval, Card, ComputerApproval, Snapshot } from '@pitchcrew/core';
import { RequestStatus } from '@/components/InboxView/components/RequestStatus.tsx';
import { decisionTitle } from '@/ClayInterface/jobs.ts';
import type { Decision } from '@/ClayInterface/signals.ts';

type DecisionHeadingProps = {
  decision: Decision;
  data: Snapshot;
  card: Card | undefined;
  packet?: Approval | undefined;
  browser?: ComputerApproval | undefined;
  openCard: (id: string, section?: 'application') => void;
};

const icons = {
  packet: FileCheck2,
  browser: Globe,
  question: MessageCircleQuestion,
  brief: ScrollText,
};

/** What is being decided and, on its identity line, which company and role it belongs to. */
export const DecisionHeading = ({
  decision,
  data,
  card,
  packet,
  browser,
  openCard,
}: DecisionHeadingProps) => {
  const Icon = icons[decision.kind];
  const request = packet
    ? ({ kind: 'packet', key: decision.id, approval: packet } as const)
    : browser
      ? ({ kind: 'browser', key: decision.id, approval: browser } as const)
      : undefined;
  return (
    <header className="decide-heading">
      <span className="decide-kind" data-kind={decision.kind} aria-hidden="true">
        <Icon size={15} />
      </span>
      <h2 tabIndex={-1} data-decision-focus="">
        {decision.stage && decision.stage !== 'approve'
          ? decisionTitle(decision, data)
          : decisionTitle(decision, data).replace(/\?$/u, '')}
      </h2>
      {request && request.approval.status !== 'pending' ? (
        <RequestStatus request={request} data={data} />
      ) : null}
      {card ? (
        <p className="decide-heading-meta">
          <button type="button" className="decide-job" onClick={() => openCard(card.id)}>
            <strong>{card.company}</strong> · {card.title}
            {card.fit !== null ? ` · Fit ${card.fit}` : ''}
          </button>
        </p>
      ) : null}
    </header>
  );
};
