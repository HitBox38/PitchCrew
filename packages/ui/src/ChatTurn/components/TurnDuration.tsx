import { durationLabel } from '../helpers.ts';
import { useElapsed } from '../hooks/useElapsed.ts';
export function TurnDuration({
  startedAt,
  finishedAt,
  active,
}: {
  startedAt: string;
  finishedAt: string | null;
  active: boolean;
}) {
  const now = useElapsed(active);
  const duration = durationLabel(startedAt, finishedAt ?? (active ? null : startedAt), now);
  if (active && duration === '0s') return null;
  return (
    <span className="shrink-0 text-detail text-muted-foreground tabular-nums">
      {duration === '0s' ? '<1s' : duration}
    </span>
  );
}
