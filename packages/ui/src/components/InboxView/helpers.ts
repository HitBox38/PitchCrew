import { packetNeedsAction } from '../../lib/inbox.ts';
export { packetNeedsAction } from '../../lib/inbox.ts';
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
  data: Pick<Snapshot, 'approvals' | 'computerApprovals'> & Partial<Pick<Snapshot, 'cards'>>,
  tab: InboxTab,
): ApprovalRequest[] => {
  const waiting = tab === 'pending';
  return [
    ...data.computerApprovals
      .filter((approval) => waitingStatuses.has(approval.status) === waiting)
      .map((approval) => ({ kind: 'browser' as const, key: `browser:${approval.id}`, approval })),
    ...data.approvals
      .filter((approval) => packetNeedsAction(approval, data.cards) === waiting)
      .map((approval) => ({ kind: 'packet' as const, key: `packet:${approval.id}`, approval })),
  ].sort((a, b) => b.approval.createdAt.localeCompare(a.approval.createdAt));
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

export const requestIdentity = (
  request: ApprovalRequest,
  data: Pick<Snapshot, 'cards' | 'roles'>,
) => {
  const card = data.cards.find((item) => item.id === request.approval.cardId);
  const role =
    request.kind === 'browser'
      ? data.roles.find((item) => item.id === request.approval.roleId)
      : undefined;
  return {
    card,
    sender: role?.name ?? (request.kind === 'browser' ? request.approval.roleId : 'Pitchcrew'),
    subject:
      request.kind === 'packet'
        ? 'Your application packet'
        : browserTitles[request.approval.action.kind],
    context: card
      ? `${card.title} at ${card.company}`
      : request.kind === 'browser'
        ? request.approval.page.title
        : 'Job no longer on the board',
  };
};
const browserTitles = {
  navigate: 'Open application page',
  click: 'Click a page element',
  fill: 'Fill an application field',
  select: 'Choose a form option',
  press: 'Press a key',
  upload: 'Attach application file',
  dialog: 'Resolve browser dialog',
};

/** Reading-pane intro that matches where the packet is in its approval flow. */
export const packetIntro = (approval: Approval, current: boolean) =>
  approval.status === 'pending'
    ? 'Your reviewed application packet is ready. Open the attachments to check the exact files, then approve the packet and choose how you’d like to apply.'
    : current && approval.status !== 'rejected'
      ? 'You approved this packet. Choose how you’d like to apply, or open the attachments to check the exact files.'
      : 'Your reviewed application packet. Open the attachments to check the exact files.';
