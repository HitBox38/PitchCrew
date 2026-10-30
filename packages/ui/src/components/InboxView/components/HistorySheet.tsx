import { useEffect, useRef } from 'react';
import { ArrowLeft, FileCheck2, Globe } from 'lucide-react';
import { Button } from '@/components/ui/button/components/Button.tsx';
import { RoleAvatar } from '@/components/RoleAvatar/index.tsx';
import { requestIdentity } from '../helpers.ts';
import { RequestStatus } from './RequestStatus.tsx';
import { BrowserApprovalList } from './BrowserApprovalList.tsx';
import { PacketApprovalList } from './PacketApprovalList.tsx';
import type { HistorySheetProps } from '../types.ts';

/** A past decision in the same clay sheet Decisions uses, with its files and outcome. */
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
      className="clay-decide-sheet decision-history-sheet"
      data-kind={request.kind}
      ref={sheet}
      tabIndex={-1}
      aria-label="Selected decision"
    >
      <Button
        className="decision-history-back"
        variant="ghost"
        size="sm"
        onClick={() => props.select(null)}
      >
        <ArrowLeft size={15} />
        All history
      </Button>
      <header className="clay-decide-heading">
        <span className="clay-decide-icon" aria-hidden="true">
          <Icon size={17} />
        </span>
        <h2>{subject}</h2>
        <RequestStatus request={request} data={props.data} />
        <p className="decision-history-envelope">
          <RoleAvatar agentRole={request.kind === 'browser' ? request.approval.roleId : 'system'} />
          {sender} ·{' '}
          <time dateTime={request.approval.createdAt}>
            {new Date(request.approval.createdAt).toLocaleString()}
          </time>
          {card ? (
            <button type="button" className="clay-decide-job" onClick={() => props.onOpen(card.id)}>
              {card.title} · {card.company}
            </button>
          ) : null}
        </p>
      </header>
      <div className="clay-decide-body">
        {request.kind === 'packet' ? (
          <PacketApprovalList {...props} approvals={[request.approval]} />
        ) : (
          <BrowserApprovalList {...props} computerApprovals={[request.approval]} />
        )}
      </div>
    </article>
  );
};
