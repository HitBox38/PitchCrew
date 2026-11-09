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
  hover: 'Hover over a page element',
  scroll: 'Scroll a page or container',
  drag: 'Drag a page element',
  fill: 'Fill an application field',
  select: 'Choose a form option',
  press: 'Press a key',
  upload: 'Attach application file',
  dialog: 'Resolve browser dialog',
};

const dayStart = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate());

/** History reads like a journal: today, yesterday, this week, then by month. */
export const historyGroups = (requests: ApprovalRequest[], now: Date) => {
  const today = dayStart(now).getTime();
  const day = 24 * 60 * 60 * 1000;
  const groups: { label: string; requests: ApprovalRequest[] }[] = [];
  for (const request of requests) {
    const created = new Date(request.approval.createdAt);
    const age = today - dayStart(created).getTime();
    const label =
      age <= 0
        ? 'Today'
        : age <= day
          ? 'Yesterday'
          : age < 7 * day
            ? 'Earlier this week'
            : created.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
    const last = groups.at(-1);
    if (last?.label === label) last.requests.push(request);
    else groups.push({ label, requests: [request] });
  }
  return groups;
};

/** Colour for a past decision's outcome: moss moved forward, ochre needs a look, quiet ended. */
export const historyTone = (
  request: ApprovalRequest,
  data: Pick<Snapshot, 'cards'>,
): 'moss' | 'ochre' | 'quiet' | 'teal' => {
  if (request.kind === 'browser')
    return request.approval.status === 'failed'
      ? 'ochre'
      : request.approval.status === 'rejected'
        ? 'quiet'
        : 'teal';
  const card = data.cards.find((item) => item.id === request.approval.cardId);
  if (card?.submissionAttempts?.some((attempt) => attempt.status === 'uncertain')) return 'ochre';
  if (card && ['screening', 'interviewing', 'offer'].includes(card.state)) return 'moss';
  if (request.approval.status === 'rejected') return 'quiet';
  if (!card || ['rejected', 'ghosted', 'withdrawn'].includes(card.state)) return 'quiet';
  return 'teal';
};

/** The one consequence sentence beside a packet's decision buttons. */
export const packetConsequence = (
  approval: Pick<Approval, 'status' | 'submission'>,
  company: string,
  current: boolean,
) => {
  if (!current) return '';
  if (approval.status === 'pending')
    return `Approving freezes these exact files so you can export them. Nothing is sent to ${company}.`;
  if (approval.submission?.method === 'manual')
    return 'Record the submission only after you have applied.';
  if (approval.submission) return '';
  return 'Either choice exports the files to this computer first. Nothing is sent yet; an agent asks you before the final submit.';
};
