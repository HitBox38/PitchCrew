import type { ChatMessage, Run, RunActivity, TranscriptItem } from '@pitchcrew/core';
export type { TranscriptItem } from '@pitchcrew/core';

export function transcriptItems(
  messages: ChatMessage[],
  runs: Run[],
  thread: string,
): TranscriptItem[] {
  const items: TranscriptItem[] = messages.map((message) => ({
    kind: 'message',
    id: message.id,
    createdAt: message.createdAt,
    message,
  }));
  const triggers = new Map<string, ChatMessage>();
  for (const message of messages) {
    if (message.runId && (message.from === 'user' || message.from === 'system'))
      if (!triggers.has(message.runId)) triggers.set(message.runId, message);
  }
  for (const run of runs) {
    if (
      run.threadId !== thread ||
      run.mode !== 'chat' ||
      (!run.activity?.length && run.status !== 'running')
    )
      continue;
    const trigger = triggers.get(run.id);
    items.push({
      kind: 'turn',
      id: `turn-${run.id}`,
      run,
      createdAt: trigger?.createdAt ?? run.startedAt,
    });
  }
  const rank = (item: TranscriptItem) =>
    item.kind === 'turn'
      ? 1
      : item.message.from === 'user' || item.message.from === 'system'
        ? 0
        : 2;
  return items.sort((a, b) => a.createdAt.localeCompare(b.createdAt) || rank(a) - rank(b));
}

export function activityGroups(entries: RunActivity[]) {
  const groups: { id: string; kind: 'commentary' | 'work'; entries: RunActivity[] }[] = [];
  for (const entry of entries) {
    if (entry.kind === 'commentary' && !entry.text?.trim()) continue;
    const kind = entry.kind === 'commentary' ? 'commentary' : 'work';
    const last = groups.at(-1);
    if (last?.kind === 'work' && kind === 'work') last.entries.push(entry);
    else groups.push({ id: entry.id, kind, entries: [entry] });
  }
  return groups;
}

export function durationLabel(startedAt: string, finishedAt: string | null, now: number) {
  const elapsed = Math.max(
    0,
    Math.floor(((finishedAt ? Date.parse(finishedAt) : now) - Date.parse(startedAt)) / 1000),
  );
  if (!Number.isFinite(elapsed)) return '0s';
  return elapsed < 60 ? `${elapsed}s` : `${Math.floor(elapsed / 60)}m ${elapsed % 60}s`;
}
