import { runtimeLabels } from '../lib/labels.ts';
import { isNotificationMessage } from '@pitchcrew/core/message-notifications';
import type { Snapshot } from '@pitchcrew/core';
import { pendingInstructionUpdates } from '../lib/instruction-updates.ts';
import { pendingSkillUpdates } from '../lib/skill-updates.ts';
import { skillSourceRevision } from '@pitchcrew/core/skill-updates';
import type { CrewNotification, NotificationGroupId } from './types.ts';

export const collectNotifications = (data: Snapshot): CrewNotification[] => {
  const rolesById = new Map(data.roles.map((role) => [role.id, role]));
  const cardsById = new Map(data.cards.map((card) => [card.id, card]));
  const skillsById = new Map(data.skills.map((skill) => [skill.id, skill]));
  const roleName = (id: string) => rolesById.get(id)?.name ?? id;
  const cardByThread = new Map((data.conversations ?? []).map((item) => [item.id, item.cardId]));
  const threadJob = (threadId: string) => {
    const cardId = cardByThread.get(threadId);
    return cardId ? cardsById.get(cardId)?.company : undefined;
  };
  const proposalNotices = new Map(
    data.proposals.filter((p) => p.noticeMessageId).map((p) => [p.noticeMessageId, p]),
  );
  const reviewNotices = new Map((data.pipelineReviews ?? []).map((r) => [r.noticeMessageId, r]));
  const notices = new Set(
    [...proposalNotices.keys(), ...reviewNotices.keys()].filter((id): id is string => !!id),
  );
  const notifications: CrewNotification[] = (data.notificationMessages ?? data.messages)
    .filter((m) => isNotificationMessage(m, data, notices))
    .map<CrewNotification>((m) => ({
      id: `message:${m.id}`,
      kind: m.notification ?? 'message',
      context:
        proposalNotices.has(m.id) || reviewNotices.has(m.id)
          ? 'role_proposal'
          : m.notification === 'attention'
            ? 'input'
            : 'message',
      title: proposalNotices.has(m.id)
        ? `${roleName(m.from)} suggests changes to ${roleName(proposalNotices.get(m.id)!.roleId)}`
        : reviewNotices.has(m.id)
          ? `${roleName(m.from)} saved a pipeline review`
          : messageTitle(roleName(m.from), m.notification === 'attention', threadJob(m.threadId)),
      body: m.content,
      target: `/chat/${m.threadId}` as CrewNotification['target'],
      roleId: m.from === 'user' || m.from === 'system' ? undefined : m.from,
      createdAt: m.createdAt,
    }));
  for (const a of data.approvals.filter((a) => a.status === 'pending')) {
    const card = cardsById.get(a.cardId);
    notifications.push({
      id: `approval:${a.id}`,
      kind: 'attention',
      context: 'packet_approval',
      title: card ? `${card.company} packet needs approval` : 'Packet needs approval',
      body: `${card ? `${card.title} · ` : ''}Review the packet before exporting.`,
      target: '/inbox',
      createdAt: a.createdAt,
    });
  }
  for (const a of data.computerApprovals.filter((a) => a.status === 'pending')) {
    const company = a.cardId ? cardsById.get(a.cardId)?.company : undefined;
    notifications.push({
      id: `computer:${a.id}`,
      kind: 'attention',
      context: 'browser_approval',
      title: `${roleName(a.roleId)} asks to use the browser${company ? ` for ${company}` : ''}`,
      body: a.reason,
      target: '/inbox',
      roleId: a.roleId,
      createdAt: a.createdAt,
    });
  }
  for (const p of data.proposals.filter((p) => p.status === 'pending' && !p.noticeMessageId))
    notifications.push({
      id: `proposal:${p.id}`,
      kind: 'attention',
      context: 'role_proposal',
      title: p.sourceRoleId
        ? `${roleName(p.sourceRoleId)} suggests changes to ${roleName(p.roleId)}`
        : `${roleName(p.roleId)} suggests changes to its own role`,
      body: p.reason,
      target: `/chat/${p.roleId}`,
      roleId: p.roleId,
      createdAt: p.createdAt,
    });
  for (const p of data.skillProposals.filter((p) => p.status === 'pending'))
    notifications.push({
      id: `proposal:${p.id}`,
      kind: 'attention',
      context: 'skill_proposal',
      title: p.skill?.name
        ? `${roleName(p.roleId)} suggests the ${p.skill.name} skill`
        : `${roleName(p.roleId)} suggests a skill`,
      body: p.reason,
      target: `/chat/${p.threadId ?? p.roleId}`,
      roleId: p.roleId,
      createdAt: p.createdAt,
    });
  // Shipped default changes; a dismissed or adopted revision leaves the list.
  for (const update of pendingInstructionUpdates(data)) {
    const latest = update.changes.at(-1);
    notifications.push({
      id: `instruction-update:${update.roleId}:${update.revision}`,
      kind: 'attention',
      context: 'instruction_update',
      title: `${roleName(update.roleId)} has new default instructions`,
      body: latest?.summary ?? 'Review the new default instructions in Crew.',
      target: '/crew',
      reviewId: update.roleId,
      roleId: update.roleId,
      createdAt: `${latest?.date ?? '1970-01-01'}T00:00:00.000Z`,
    });
  }
  for (const check of pendingSkillUpdates(data)) {
    const skill = skillsById.get(check.skillId);
    if (!skill) continue;
    notifications.push({
      id: `skill-update:${skill.id}:${skillSourceRevision(check.latest!)}`,
      kind: 'attention',
      context: 'skill_update',
      title: `${skill.name} has an upstream update`,
      body: 'Review the new skill version before replacing your saved instructions.',
      target: '/skills',
      reviewId: skill.id,
      createdAt: check.detectedAt ?? check.checkedAt,
    });
  }
  for (const update of data.runtimeMaintenance?.updates ?? []) {
    const operation = update.operation;
    if (update.status !== 'available' && !operation) continue;
    notifications.push({
      id: `runtime-update:${update.id}:${operation?.id ?? update.latestVersion}:${operation?.stage ?? 'available'}`,
      kind: 'attention',
      context: 'runtime_update',
      title: `${runtimeLabels[update.id]} ${operation ? `update: ${operation.stage}` : 'has an update'}`,
      body:
        operation?.detail ??
        `Version ${update.latestVersion} is available. Update from Settings when the runtime is idle.`,
      target: '/settings',
      reviewId: update.id,
      createdAt:
        operation?.finishedAt ??
        operation?.startedAt ??
        update.checkedAt ??
        '1970-01-01T00:00:00.000Z',
    });
  }
  return (
    notifications
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt) || a.id.localeCompare(b.id))
      // Only saved messages are capped: a request still waiting on the user never drops out of the
      // bell behind newer messages.
      .filter((item, index) => index < 100 || !item.id.startsWith('message:'))
  );
};
/** A message notice names who wrote and, in a job's conversation, the job. */
const messageTitle = (from: string, asks: boolean, company?: string) =>
  asks
    ? company
      ? `${from} asks about ${company}`
      : `${from} asks you a question`
    : company
      ? `${from} wrote about ${company}`
      : `${from} sent a message`;

/** Maintenance notices remain visible without interrupting current work. */
export const notificationShouldAlert = (item: Pick<CrewNotification, 'context'>) => {
  return (
    item.context !== 'instruction_update' &&
    item.context !== 'skill_update' &&
    item.context !== 'runtime_update'
  );
};
/** A visible message or the exact question already open in its dock needs no duplicate toast. */
export const notificationInView = (
  item: Pick<CrewNotification, 'context' | 'target'> & Partial<Pick<CrewNotification, 'id'>>,
  pathname: string,
  visible: boolean,
  visibleQuestionIds: ReadonlySet<string> = new Set(),
) =>
  visible &&
  pathname === item.target &&
  (item.context === 'message' ||
    (item.context === 'input' && !!item.id && visibleQuestionIds.has(item.id)));
export const readStored = <T>(
  key: string,
  fallback: T,
  validate: (value: unknown) => value is T,
): T => {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(key) ?? 'null');
    return validate(value) ? value : fallback;
  } catch {
    return fallback;
  }
};
export const saveStored = (key: string, value: unknown) => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* Notifications still work without storage. */
  }
};

export const notificationPreview = (body: string) => {
  const text = body.replace(/\s+/g, ' ').trim();
  if (text.length <= 96) return text;
  const excerpt = text.slice(0, 95);
  const lastSpace = excerpt.lastIndexOf(' ');
  return `${lastSpace > 60 ? excerpt.slice(0, lastSpace) : excerpt}…`;
};

export const notificationToastOptions = (item: CrewNotification) => {
  return {
    id: item.id,
    title: item.title,
    description: item.kind === 'attention' ? notificationPreview(item.body) : undefined,
    type: item.kind === 'attention' ? 'warning' : 'info',
    timeout: item.kind === 'attention' ? 12000 : 6000,
    priority: 'low' as const,
    data: item,
  };
};

/** Baseline history is silent; only IDs absent from the previous history can alert. */
export class NotificationTracker {
  private seen: Set<string> | null = null;
  update = (items: CrewNotification[]): CrewNotification[] => {
    const fresh = this.seen ? items.filter((item) => !this.seen!.has(item.id)) : [];
    this.seen ??= new Set();
    items.forEach((item) => this.seen!.add(item.id));
    return fresh;
  };
}

/** Requests that wait on the user, shipped updates to review, and plain crew messages. */
export const notificationGroup = (item: Pick<CrewNotification, 'context'>): NotificationGroupId =>
  item.context === 'message' ? 'messages' : notificationShouldAlert(item) ? 'needs' : 'updates';

const notificationGroupTitles: Record<NotificationGroupId, string> = {
  needs: 'Needs you',
  updates: 'Updates',
  messages: 'Messages',
};

/** Groups in panel order, each keeping the newest-first order; empty groups are left out. */
export const groupNotifications = (items: CrewNotification[]) =>
  (['needs', 'updates', 'messages'] as const)
    .map((id) => ({
      id,
      title: notificationGroupTitles[id],
      items: items.filter((item) => notificationGroup(item) === id),
    }))
    .filter((group) => group.items.length);
