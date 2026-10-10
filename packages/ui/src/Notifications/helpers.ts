import type { Snapshot } from '@pitchcrew/core';
import { pendingInstructionUpdates } from '../lib/instruction-updates.ts';
import type { CrewNotification } from './types.ts';

export function collectNotifications(data: Snapshot): CrewNotification[] {
  const roleName = (id: string) => data.roles.find((r) => r.id === id)?.name ?? id;
  const proposalNotices = new Map(
    data.proposals.filter((p) => p.noticeMessageId).map((p) => [p.noticeMessageId, p]),
  );
  const reviewNotices = new Map((data.pipelineReviews ?? []).map((r) => [r.noticeMessageId, r]));
  const notifications: CrewNotification[] = data.messages
    .filter((m) => {
      if (
        m.userInput?.kind === 'question' &&
        !data.userInputs?.some((q) => q.id === m.userInput?.id && q.status === 'pending')
      )
        return false;
      if (m.from === 'user' || m.from === 'system') return false;
      const conversation = data.conversations?.find((item) => item.id === m.threadId);
      if (
        !conversation ||
        m.notification ||
        proposalNotices.has(m.id) ||
        reviewNotices.has(m.id) ||
        conversation.notifyAll
      )
        return true;
      if (['history', 'agent_dm'].includes(conversation.kind)) return false;
      return (
        conversation.kind === 'direct' ||
        conversation.kind === 'routine' ||
        m.from === conversation.leadId
      );
    })
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
          : `${roleName(m.from)}${m.notification === 'attention' ? ' needs your answer' : ' sent a message'}`,
      body: m.content,
      target: `/chat/${m.threadId}` as CrewNotification['target'],
      createdAt: m.createdAt,
    }));
  for (const a of data.approvals.filter((a) => a.status === 'pending')) {
    const card = data.cards.find((c) => c.id === a.cardId);
    notifications.push({
      id: `approval:${a.id}`,
      kind: 'attention',
      context: 'packet_approval',
      title: 'Packet approval needed',
      body: `Review the packet${card ? ` for ${card.company}` : ''} before exporting.`,
      target: '/inbox',
      createdAt: a.createdAt,
    });
  }
  for (const a of data.computerApprovals.filter((a) => a.status === 'pending'))
    notifications.push({
      id: `computer:${a.id}`,
      kind: 'attention',
      context: 'browser_approval',
      title: `${roleName(a.roleId)} needs browser approval`,
      body: a.reason,
      target: '/inbox',
      createdAt: a.createdAt,
    });
  for (const p of data.proposals.filter((p) => p.status === 'pending' && !p.noticeMessageId))
    notifications.push({
      id: `proposal:${p.id}`,
      kind: 'attention',
      context: 'role_proposal',
      title: `${roleName(p.roleId)} suggests a role change`,
      body: p.reason,
      target: `/chat/${p.roleId}`,
      createdAt: p.createdAt,
    });
  for (const p of data.skillProposals.filter((p) => p.status === 'pending'))
    notifications.push({
      id: `proposal:${p.id}`,
      kind: 'attention',
      context: 'skill_proposal',
      title: `${roleName(p.roleId)} suggests a skill`,
      body: p.reason,
      target: `/chat/${p.threadId ?? p.roleId}`,
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
      createdAt: `${latest?.date ?? '1970-01-01'}T00:00:00.000Z`,
    });
  }
  return notifications
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt) || a.id.localeCompare(b.id))
    .slice(0, 100);
}
export function readStored<T>(
  key: string,
  fallback: T,
  validate: (value: unknown) => value is T,
): T {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(key) ?? 'null');
    return validate(value) ? value : fallback;
  } catch {
    return fallback;
  }
}
export function saveStored(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* Notifications still work without storage. */
  }
}

/** Baseline history is silent; only IDs absent from the previous history can alert. */
export class NotificationTracker {
  private seen: Set<string> | null = null;
  update(items: CrewNotification[]): CrewNotification[] {
    const fresh = this.seen ? items.filter((item) => !this.seen!.has(item.id)) : [];
    this.seen ??= new Set();
    items.forEach((item) => this.seen!.add(item.id));
    return fresh;
  }
}

export function notificationPreview(body: string) {
  const text = body.replace(/\s+/g, ' ').trim();
  if (text.length <= 96) return text;
  const excerpt = text.slice(0, 95);
  const lastSpace = excerpt.lastIndexOf(' ');
  return `${lastSpace > 60 ? excerpt.slice(0, lastSpace) : excerpt}…`;
}

export function notificationToastOptions(item: CrewNotification) {
  return {
    id: item.id,
    title: item.title,
    description: item.kind === 'attention' ? notificationPreview(item.body) : undefined,
    type: item.kind === 'attention' ? 'warning' : 'info',
    timeout: item.kind === 'attention' ? 12000 : 6000,
    priority: 'low' as const,
    data: item,
  };
}
