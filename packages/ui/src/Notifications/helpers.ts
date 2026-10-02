import type { Snapshot } from '@pitchcrew/core';
import type { CrewNotification } from './types.ts';

export function collectNotifications(data: Snapshot): CrewNotification[] {
  const roleName = (id: string) => data.roles.find((r) => r.id === id)?.name ?? id;
  const notifications: CrewNotification[] = data.messages
    .filter((m) => m.from !== 'user' && m.from !== 'system')
    .map((m) => ({
      id: `message:${m.id}`,
      kind: m.notification ?? 'message',
      title: `${roleName(m.from)}${m.notification === 'attention' ? ' needs your input' : ' sent a message'}`,
      body: m.content,
      target: `/chat/${m.threadId}` as CrewNotification['target'],
      createdAt: m.createdAt,
    }));
  for (const a of data.approvals.filter((a) => a.status === 'pending')) {
    const card = data.cards.find((c) => c.id === a.cardId);
    notifications.push({
      id: `approval:${a.id}`,
      kind: 'attention',
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
      title: `${roleName(a.roleId)} needs browser approval`,
      body: a.reason,
      target: '/inbox',
      createdAt: a.createdAt,
    });
  for (const p of [...data.proposals, ...data.skillProposals].filter((p) => p.status === 'pending'))
    notifications.push({
      id: `proposal:${p.id}`,
      kind: 'attention',
      title: `${roleName(p.roleId)} has a proposal`,
      body: p.reason,
      target: `/chat/${'threadId' in p ? p.threadId : p.roleId}`,
      createdAt: p.createdAt,
    });
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
