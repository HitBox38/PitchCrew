import type { ComputerApproval } from '@pitchcrew/core';
import { approvalParts } from '@/ComputerApprovals/helpers.ts';

/** A quoted part whose quotes stay put while only the text between them shortens. */
const Quoted = ({ text, className }: { text: string; className: string }) => {
  const quoted = text.startsWith('“') && text.endsWith('”');
  return (
    <span className={className}>
      {quoted ? <span aria-hidden="true">“</span> : null}
      <span className="browser-approval-text">{quoted ? text.slice(1, -1) : text}</span>
      {quoted ? <span aria-hidden="true">”</span> : null}
    </span>
  );
};

/**
 * The request's title in parts: when space runs out the value shortens first (its quotes stay),
 * while the verb stays whole and the target keeps its full name until it would fill the line.
 */
export const BrowserApprovalTitle = ({
  approval,
  summary,
}: {
  approval: ComputerApproval;
  summary: string;
}) => {
  const parts = approvalParts(approval.action, approval.page);
  return (
    <strong className="browser-approval-title" title={summary}>
      <span>{parts.verb}</span>
      {parts.value ? <Quoted text={parts.value} className="browser-approval-value" /> : null}
      {parts.joiner ? <span>{parts.joiner}</span> : null}
      <Quoted text={parts.target} className="browser-approval-object" />
    </strong>
  );
};
