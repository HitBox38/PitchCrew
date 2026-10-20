import { useEffect, useRef } from 'react';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button/components/Button.tsx';
import { AnimatePresence } from 'motion/react';
import { BrowserApprovalList } from './BrowserApprovalList.tsx';
import { PacketApprovalList } from './PacketApprovalList.tsx';
import type { InboxReviewProps } from '../types.ts';

export const InboxReview = (props: InboxReviewProps) => {
  const { request, reviewOpen, showRequests } = props;
  const review = useRef<HTMLElement>(null);
  useEffect(() => {
    if (reviewOpen) review.current?.focus({ preventScroll: true });
  }, [reviewOpen, request.key]);
  return (
    <section
      className="inbox-review"
      ref={review}
      tabIndex={-1}
      aria-label="Selected approval review"
    >
      <Button className="inbox-back text-button" onClick={showRequests}>
        <ArrowLeft size={15} /> All requests
      </Button>
      <AnimatePresence initial={false} mode="wait">
        {request.kind === 'browser' ? (
          <BrowserApprovalList
            key={request.key}
            {...props}
            computerApprovals={[request.approval]}
          />
        ) : (
          <PacketApprovalList key={request.key} {...props} approvals={[request.approval]} />
        )}
      </AnimatePresence>
    </section>
  );
};
