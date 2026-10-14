import { useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button/components/Button.tsx';
import { browserActionTitles, browserStatusLabels } from '@/ComputerApprovals/helpers.ts';
import { timeAgo } from '@/lib/time.ts';
import { FileText, Globe } from 'lucide-react';
import { packetStatusLabel } from '../helpers.ts';
import type { InboxRequestListProps } from '../types.ts';

export function InboxRequestList({
  requests,
  selectedRequest,
  selectRequest,
  data,
  tab,
  reviewOpen,
}: InboxRequestListProps) {
  const list = useRef<HTMLElement>(null);
  const previous = useRef({ reviewOpen, tab });
  useEffect(() => {
    if (previous.current.reviewOpen && !reviewOpen && previous.current.tab === tab) {
      list.current?.querySelector<HTMLButtonElement>('[aria-current="true"]')?.focus();
    }
    previous.current = { reviewOpen, tab };
  }, [reviewOpen, tab]);
  return (
    <aside
      ref={list}
      className="inbox-request-list"
      aria-label={tab === 'pending' ? 'Waiting requests' : 'Decided requests'}
    >
      <div className="inbox-list-heading">
        <h2>{tab === 'pending' ? 'Waiting for you' : 'Past decisions'}</h2>
        <span>{requests.length}</span>
      </div>
      <div className="inbox-request-scroll">
        {requests.map((request) => {
          const { approval } = request;
          const browser = request.kind === 'browser';
          const card = data.cards.find((item) => item.id === approval.cardId);
          const title = browser
            ? browserActionTitles[request.approval.action.kind]
            : 'Export application packet';
          const subtitle = browser
            ? request.approval.page.title || 'New browser'
            : card
              ? `${card.title} at ${card.company}`
              : 'Application packet';
          const status = browser
            ? browserStatusLabels[request.approval.status]
            : packetStatusLabel(request.approval.status);
          return (
            <Button
              key={request.key}
              className="inbox-request"
              aria-current={selectedRequest?.key === request.key ? 'true' : undefined}
              onClick={() => selectRequest(request.key)}
            >
              <span className="inbox-request-icon">
                {browser ? <Globe size={17} /> : <FileText size={17} />}
              </span>
              <span className="inbox-request-content">
                <strong>{title}</strong>
                <span>{subtitle}</span>
                <span className="inbox-request-meta">
                  <span>{status}</span>
                  <time dateTime={approval.createdAt}>{timeAgo(approval.createdAt)}</time>
                </span>
              </span>
            </Button>
          );
        })}
      </div>
    </aside>
  );
}
