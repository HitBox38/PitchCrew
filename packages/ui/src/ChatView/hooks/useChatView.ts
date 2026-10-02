import { useAppReducedMotion } from '@/AppMotion/hooks/useAppReducedMotion.ts';
import type { ChatThread, ChatViewProps } from '@/ChatView/types.ts';
import type { ChatMessage, RoleId } from '@pitchcrew/core';
import { useRef, useState } from 'react';

export function useChatView({
  data,
  thread,
  onThread,
  onConfigure,
  onOpenCard,
  action,
  working,
}: ChatViewProps) {
  const reduced = useAppReducedMotion();
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const [drafts, setDrafts] = useState<Partial<Record<ChatThread, string>>>({});
  const [jobs, setJobs] = useState<Partial<Record<ChatThread, string>>>({});
  const [recipient, setRecipient] = useState<RoleId>('scout');
  const [panes, setPanes] = useState<Partial<Record<ChatThread, 'conversation' | 'work'>>>({});
  const pane = panes[thread] ?? 'conversation';
  const setPane = (next: 'conversation' | 'work') =>
    setPanes((current) => ({ ...current, [thread]: next }));
  const [error, setError] = useState('');
  const roleId = thread === 'crew' ? recipient : thread;
  const role = data.roles.find((r) => r.id === roleId)!;
  const streamingIds = new Set(data.streamingMessages.map((message) => message.id));
  const messages = [...data.messages, ...data.streamingMessages].filter(
    (m) => m.threadId === thread,
  );
  const running = data.runs.filter(
    (r) => r.status === 'running' && (thread === 'crew' || r.roleId === roleId),
  );
  const busy = data.runs.some((r) => r.roleId === roleId && r.status === 'running');
  const available = data.runtimes.some((r) => r.id === role.runtime && r.available);
  const draft = drafts[thread] ?? '';
  const cardId = jobs[thread] ?? '';
  const proposals = data.proposals.filter(
    (p) => (thread === 'crew' || p.roleId === thread) && p.status === 'pending',
  );
  const skillProposals = data.skillProposals.filter(
    (p) => (thread === 'crew' || p.roleId === thread) && p.status === 'pending',
  );
  const tasks = data.tasks
    .filter((t) => thread === 'crew' || t.roleId === thread)
    .slice(-12)
    .reverse();
  const attention =
    proposals.length +
    skillProposals.length +
    tasks.filter((task) => ['queued', 'running'].includes(task.status)).length;
  const jobItems = [
    { value: '', label: 'Attach a job' },
    ...data.cards.map((card) => ({ value: card.id, label: `${card.company} · ${card.title}` })),
  ];
  const recipientItems = data.roles.map((item) => ({ value: item.id, label: item.name }));
  const attached = data.cards.find((card) => card.id === cardId);
  const roleState = !role.enabled
    ? 'Paused'
    : !available
      ? 'Unavailable'
      : busy
        ? 'Working'
        : 'Ready';
  const name = (id: ChatMessage['from'] | ChatMessage['to']) =>
    id === 'user'
      ? 'You'
      : id === 'crew'
        ? 'Crew'
        : id === 'system'
          ? 'Pitchcrew'
          : (data.roles.find((r) => r.id === id)?.name ?? id);
  const applyStarter = (prompt: string) => {
    setDrafts((current) => ({ ...current, [thread]: prompt }));
    inputRef.current?.focus();
  };
  async function send(text: string) {
    if (!text.trim() || busy || working || !role.enabled || !available) return;
    const sentThread = thread;
    setPane('conversation');
    setError('');
    try {
      await action(`/roles/${roleId}/chat`, 'POST', {
        content: text,
        cardId: cardId || null,
        threadId: thread,
      });
      setDrafts((current) => ({ ...current, [sentThread]: '' }));
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Could not send your message.');
    }
  }
  return {
    data,
    thread,
    onThread,
    onConfigure,
    onOpenCard,
    action,
    working,
    reduced,
    inputRef,
    setDrafts,
    setJobs,
    recipient,
    setRecipient,
    pane,
    setPane,
    error,
    setError,
    roleId,
    role,
    streamingIds,
    messages,
    running,
    busy,
    available,
    draft,
    cardId,
    proposals,
    skillProposals,
    tasks,
    attention,
    jobItems,
    recipientItems,
    attached,
    roleState,
    name,
    applyStarter,
    send,
  };
}
