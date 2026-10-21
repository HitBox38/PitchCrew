import { useEffect, useRef } from 'react';
import { ArrowLeft, ArrowRight, Mail } from 'lucide-react';
import { Button } from '@/components/ui/button/components/Button.tsx';
import { RoleAvatar } from '@/components/RoleAvatar/index.tsx';
import { requestIdentity } from '../helpers.ts';
import { requestStatus } from '../status.ts';
import { PacketApprovalList } from './PacketApprovalList.tsx';
import { BrowserApprovalList } from './BrowserApprovalList.tsx';
import type { InboxReviewProps } from '../types.ts';
export const InboxReview = (props: InboxReviewProps) => {
  const { request, showRequests } = props;
  const { sender, context, subject } = requestIdentity(request, props.data);
  const review = useRef<HTMLElement>(null);
  useEffect(() => {
    review.current?.focus({ preventScroll: true });
  }, [request.key]);
  const next = props.requests.find((item) => item.key !== request.key);
  return (
    <section className="mail-reading" ref={review} tabIndex={-1} aria-label="Selected request">
      <div className="mail-reading-toolbar">
        <Button size="sm" variant="ghost" onClick={showRequests}>
          <ArrowLeft size={16} />
          Back to inbox
        </Button>
        <Button size="sm" variant="ghost" onClick={() => props.markRead(request.key, false)}>
          <Mail size={15} />
          Mark unread
        </Button>
        <Button
          size="sm"
          variant="ghost"
          disabled={!next}
          onClick={() => next && props.selectRequest(next.key)}
        >
          Next request
          <ArrowRight size={15} />
        </Button>
      </div>
      <header className="mail-reading-header">
        <div className="mail-subject">
          <h2>{subject}</h2>
          <span className="badge">{requestStatus(request, props.data)}</span>
        </div>
        <div className="mail-envelope">
          <RoleAvatar agentRole={request.kind === 'browser' ? request.approval.roleId : 'system'} />
          <div>
            <strong>{sender}</strong>
            <p>{context}</p>
          </div>
          <time dateTime={request.approval.createdAt}>
            {new Date(request.approval.createdAt).toLocaleString()}
          </time>
        </div>
      </header>
      {request.kind === 'packet' ? (
        <PacketApprovalList {...props} approvals={[request.approval]} />
      ) : (
        <BrowserApprovalList {...props} computerApprovals={[request.approval]} />
      )}
    </section>
  );
};
