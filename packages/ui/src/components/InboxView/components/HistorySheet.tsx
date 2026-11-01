import { useEffect, useRef } from 'react';
import { ArrowLeft, FileCheck2, Globe } from 'lucide-react';
import { Button } from '@pitchcrew/design-system/button';
import { requestIdentity } from '../helpers.ts';
import { DecisionOutcomeChip, DecisionStage } from './DecisionOutcome.tsx';
import { BrowserApprovalDetails } from './BrowserApprovalDetails.tsx';
import { PacketDetails } from './PacketDetails.tsx';
import { PacketApprovalActions } from './PacketApprovalActions.tsx';
import type { HistorySheetProps } from '../types.ts';

/** A past decision in the same sheet Decisions uses, read-only, with its files and outcome. */
export const HistorySheet = (props: HistorySheetProps) => {
  const { request } = props;
  const { card, sender, subject } = requestIdentity(request, props.data);
  const Icon = request.kind === 'packet' ? FileCheck2 : Globe;
  const sheet = useRef<HTMLElement>(null);
  useEffect(() => {
    sheet.current?.focus({ preventScroll: true });
  }, [request.key]);
  return (
    <article
      className="decide-sheet decision-history-sheet"
      data-kind={request.kind}
      ref={sheet}
      tabIndex={-1}
      aria-label="Selected decision"
    >
      <div className="decide-sheet-scroll">
        <div className="decide-main">
          <Button
            className="decision-history-back"
            variant="ghost"
            size="sm"
            onClick={() => props.select(null)}
          >
            <ArrowLeft size={15} />
            Back to history
          </Button>
          <header className="decide-heading">
            <span className="decide-kind" data-kind={request.kind} aria-hidden="true">
              <Icon size={15} />
            </span>
            <h2>{request.kind === 'packet' && card ? `${card.company} packet` : subject}</h2>
            <DecisionOutcomeChip request={request} />
            <p className="decide-heading-meta">
              {sender} ·{' '}
              <time dateTime={request.approval.createdAt}>
                {new Date(request.approval.createdAt).toLocaleString()}
              </time>
              {card ? (
                <>
                  {' · '}
                  <button
                    type="button"
                    className="decide-job"
                    onClick={() => props.onOpen(card.id)}
                  >
                    <strong>{card.company}</strong> · {card.title}
                  </button>
                </>
              ) : null}
              <DecisionStage request={request} data={props.data} />
            </p>
          </header>
          {request.kind === 'packet' ? (
            <PacketDetails approval={request.approval} data={props.data} />
          ) : (
            <BrowserApprovalDetails approval={request.approval} />
          )}
        </div>
      </div>
      {request.kind === 'packet' && card ? (
        <PacketApprovalActions {...props} approval={request.approval} card={card} />
      ) : null}
    </article>
  );
};
