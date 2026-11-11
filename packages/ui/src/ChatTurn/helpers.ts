import { turnPresentation } from './constants.ts';
import { runtimeLabels } from '../lib/labels.ts';
import { reasoningLabels } from '../lib/reasoning.ts';
import { transcriptOrder } from '@pitchcrew/core/transcript-order';
import { visibleTranscriptMessages } from './transcript-messages.ts';
import type { AgentTask, ChatRequest } from '@pitchcrew/core';
import type { ChatMessage, Run, RunActivity, RuntimeModel, TranscriptItem } from '@pitchcrew/core';
export type { TranscriptItem } from '@pitchcrew/core';

export const transcriptItems = (
  messages: ChatMessage[],
  runs: Run[],
  thread: string,
  context: {
    requests?: ChatRequest[];
    tasks?: AgentTask[];
    positions?: ReadonlyMap<string, string>;
    dispatchRuns?: Run[];
  } = {},
): TranscriptItem[] => {
  const dispatchRuns = (context.dispatchRuns ?? runs).filter(
    (run) =>
      run.threadId === thread &&
      ['chat', 'workflow'].includes(run.mode ?? '') &&
      !run.reviewSeatReservation,
  );
  const startedRequests = new Set(
    dispatchRuns.flatMap((run) => (run.requestId ? [run.requestId] : [])),
  );
  const visible = visibleTranscriptMessages(
    messages,
    context.requests,
    context.tasks,
    startedRequests,
  );
  const displayedRuns = runs.filter(
    (run) =>
      run.threadId === thread &&
      ['chat', 'workflow'].includes(run.mode ?? '') &&
      !run.reviewSeatReservation &&
      (run.activity?.length || ['running', 'waiting', 'failed', 'cancelled'].includes(run.status)),
  );
  const byMessage = new Map(visible.map((message) => [message.id, message]));
  const byRun = new Map(displayedRuns.map((run) => [run.id, run]));
  return transcriptOrder(
    visible.map((message) => ({
      id: message.id,
      createdAt: message.createdAt,
      sender: message.from,
      recipient: message.to,
      runId: message.runId,
      notification: message.notification,
      userInput: message.userInput?.kind,
      content: message.content,
      positionedAt: context.positions?.get(message.id),
    })),
    displayedRuns,
    {
      requests: context.requests,
      dispatchRuns,
    },
  ).map((item) =>
    item.kind === 'message'
      ? {
          kind: 'message',
          id: item.id,
          createdAt: item.createdAt,
          message: byMessage.get(item.id)!,
        }
      : {
          kind: 'turn',
          id: item.id,
          createdAt: item.createdAt,
          run: byRun.get(item.runId!)!,
        },
  );
};

export const activityGroups = (entries: RunActivity[]) => {
  const groups: { id: string; kind: 'commentary' | 'work'; entries: RunActivity[] }[] = [];
  for (const entry of entries) {
    if (entry.kind === 'commentary' && !entry.text?.trim()) continue;
    const kind = entry.kind === 'commentary' ? 'commentary' : 'work';
    const last = groups.at(-1);
    if (last?.kind === 'work' && kind === 'work') last.entries.push(entry);
    else groups.push({ id: entry.id, kind, entries: [entry] });
  }
  return groups;
};

export const elapsedLabel = (milliseconds: number) => {
  const elapsed = Math.max(0, Math.floor(milliseconds / 1000));
  if (!Number.isFinite(elapsed)) return '0s';
  return elapsed < 60 ? `${elapsed}s` : `${Math.floor(elapsed / 60)}m ${elapsed % 60}s`;
};

export const turnStatus = (run: Run, replying: boolean) => {
  const presentation = turnPresentation[run.status];
  if (run.status !== 'running') return { ...presentation, status: presentation.label };
  const phase = run.activity?.findLast(
    (entry) => entry.status === 'running' && entry.kind !== 'commentary',
  );
  return {
    ...presentation,
    status: replying ? 'Replying…' : (phase?.label ?? (run.message || 'Working…')),
  };
};

/**
 * The model and reasoning a turn actually ran with. Compact snapshots carry the derived
 * `model`/`reasoning`; full snapshots still have the configuration snapshot. A runtime catalog,
 * when supplied, replaces the raw model id with its display label.
 */
export const runModel = (run: Run, models?: readonly RuntimeModel[]) => {
  const role = run.configuration?.role;
  const model = run.model || role?.model;
  const reasoning = run.reasoning ?? role?.reasoning;
  const label = model && (models?.find((item) => item.value === model)?.label || model);
  return [label || runtimeLabels[run.runtime], reasoning && reasoningLabels[reasoning]]
    .filter(Boolean)
    .join(' · ');
};
