import { FileCheck2, Globe, Paperclip } from 'lucide-react';
import { timeAgo } from '@/lib/time.ts';
import { attachmentFiles } from '@/FileViewer/attachments.ts';
import { packetHandoff } from '../handoff.ts';
import { requestIdentity } from '../helpers.ts';
import { DecisionOutcomeChip, DecisionStage } from './DecisionOutcome.tsx';
import type { ApprovalRequest, InboxViewModel } from '../types.ts';

type HistoryRowProps = { request: ApprovalRequest; model: InboxViewModel };

/** One past decision: the job, who asked, the Reviewer's line, its outcome and when. */
export const HistoryRow = ({ request, model }: HistoryRowProps) => {
  const { sender, subject, context } = requestIdentity(request, model.data);
  const Icon = request.kind === 'packet' ? FileCheck2 : Globe;
  const files = attachmentFiles(request).length;
  const assessment =
    request.kind === 'packet'
      ? packetHandoff(request.approval, model.data).summary?.assessment
      : undefined;
  const selected = model.selectedRequest?.key === request.key;
  return (
    <li>
      <button
        type="button"
        className="decision-history-row"
        data-request-key={request.key}
        aria-current={selected ? 'true' : undefined}
        onClick={() => model.select(request.key)}
      >
        <span className="decision-history-kind" aria-hidden="true">
          <Icon size={15} />
        </span>
        <span className="decision-history-text">
          <strong>{context}</strong>
          <span className="decision-history-sub">
            {subject} · {sender}
            <DecisionStage request={request} data={model.data} />
          </span>
          {assessment ? <span className="decision-history-quote">{assessment}</span> : null}
        </span>
        <span className="decision-history-meta">
          <DecisionOutcomeChip request={request} />
          <span>
            {files ? (
              <>
                <Paperclip size={12} aria-label="Files" /> {files} ·{' '}
              </>
            ) : null}
            <time dateTime={request.approval.createdAt}>{timeAgo(request.approval.createdAt)}</time>
          </span>
        </span>
      </button>
    </li>
  );
};
