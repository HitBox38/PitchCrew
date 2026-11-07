import { useMemo } from 'react';
import { elapsedLabel } from '../helpers.ts';
import { questionWaits, turnTiming } from '../timing.ts';
import { useElapsed } from '../hooks/useElapsed.ts';
import { useWorkspaceStore } from '@/WorkspaceStore/index.ts';
export const TurnDuration = ({
  runId,
  startedAt,
  finishedAt,
  active,
}: {
  runId?: string;
  startedAt: string;
  finishedAt: string | null;
  active: boolean;
}) => {
  const now = useElapsed(active);
  const questions = useWorkspaceStore((state) => state.data?.userInputs);
  const runs = useWorkspaceStore((state) => state.data?.runs);
  const waits = useMemo(
    () => (runId ? questionWaits(runId, questions ?? [], runs ?? []) : []),
    [runId, questions, runs],
  );
  const timing = turnTiming(
    startedAt,
    finishedAt ?? (active || waits.length ? null : startedAt),
    now,
    waits,
  );
  const duration = elapsedLabel(timing.worked);
  const pauses = [
    timing.waited >= 1000 ? `${elapsedLabel(timing.waited)} waiting for your answer` : '',
    timing.queued >= 1000 ? `${elapsedLabel(timing.queued)} waiting for a continuation` : '',
  ]
    .filter(Boolean)
    .join(' and ');
  const excluded = pauses ? `Excludes ${pauses}.` : undefined;
  if (active && duration === '0s') return null;
  return (
    <span className="shrink-0 text-detail text-muted-foreground tabular-nums" title={excluded}>
      {duration === '0s' ? '<1s' : duration}
      {excluded ? <span className="sr-only"> of agent work. {excluded}</span> : null}
    </span>
  );
};
