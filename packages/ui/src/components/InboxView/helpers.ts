import type { ApprovalRequest, InboxTab } from './types.ts';
import type { Approval, PacketArtifact, Snapshot } from '@pitchcrew/core';

// PDF counts come from the frozen bytes. DOCX counts are the formatted layout's estimate.
export const pageLabel = (artifact: PacketArtifact, pages: ArtifactPages) => {
  const count = pages?.[artifact.digest];
  if (count === undefined) return undefined;
  const label = `${count} ${count === 1 ? 'page' : 'pages'}`;
  return artifact.mimeType === 'application/pdf' ? label : `about ${label} in Word`;
};

export const resumePageWarning = (artifacts: PacketArtifact[], pages: ArtifactPages) => {
  const counts = artifacts
    .filter((artifact) => artifact.source === 'resume')
    .map((artifact) => pages?.[artifact.digest] ?? 0);
  const most = Math.max(0, ...counts);
  return most > 1
    ? `The resume runs to ${most} pages. The target is one page. Reject and ask the Writer to shorten it, or approve if you want a longer resume.`
    : undefined;
};

export const approvalRequests = (
  data: Pick<Snapshot, 'approvals' | 'computerApprovals'>,
  tab: InboxTab,
): ApprovalRequest[] => {
  const waiting = tab === 'pending';
  return [
    ...data.computerApprovals
      .filter((approval) => waitingStatuses.has(approval.status) === waiting)
      .map((approval) => ({ kind: 'browser' as const, key: `browser:${approval.id}`, approval })),
    ...data.approvals
      .filter((approval) => waitingStatuses.has(approval.status) === waiting)
      .map((approval) => ({ kind: 'packet' as const, key: `packet:${approval.id}`, approval })),
  ];
};

export const selectedApprovalRequest = (requests: ApprovalRequest[], key: string | null) => {
  return requests.find((request) => request.key === key) ?? requests[0];
};

export const packetStatusLabel = (status: Approval['status']) => {
  return {
    pending: 'Needs approval',
    approved: 'Approved',
    consumed: 'Exported',
    rejected: 'Rejected',
  }[status];
};

export type ArtifactPages = Record<string, number> | undefined;

const waitingStatuses = new Set(['pending', 'approved']);
