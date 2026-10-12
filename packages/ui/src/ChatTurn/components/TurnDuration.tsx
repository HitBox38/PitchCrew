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
  return (
    <span className="shrink-0 text-detail text-muted-foreground tabular-nums">
      {durationLabel(startedAt, finishedAt ?? (active ? null : startedAt), now)}
    </span>
  );
}
