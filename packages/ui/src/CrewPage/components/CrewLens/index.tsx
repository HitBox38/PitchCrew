import { useMemo } from 'react';
import type { Snapshot } from '@pitchcrew/core';
import { useAttention } from '@/hooks/useAttention.ts';
import { crewLens } from '@/lib/crew-lens.ts';
import { liveRunIndex } from '@/lib/live-runs.ts';
import { LensIdle } from './components/LensIdle.tsx';
import { LensRow } from './components/LensRow.tsx';
import { useLensNarrow } from './hooks/useLensNarrow.ts';
import { useLensOrder } from './hooks/useLensOrder.ts';

/**
 * At work: one row per busy agent with every job-owned run, wait, queued, held and failed request,
 * idle agents folded into one tray. It is a view over the job queues (ADR 0002): it orders nothing,
 * approves nothing (a wait opens its Needs you item on Home) and its only controls act on one job
 * or conversation queue. It has no count of its own: Crew's title row already says how many work.
 */
export const CrewLens = ({ data, now }: { data: Snapshot; now: number }) => {
  const items = useAttention();
  const rows = useMemo(() => crewLens(data, items, liveRunIndex(data), now), [data, items, now]);
  const busy = useLensOrder(rows);
  const { ref, narrow } = useLensNarrow();
  if (!rows.length) return null;
  return (
    <section ref={ref} className="ui-section crew-lens" aria-labelledby="crew-lens-heading">
      <h2 className="ui-section-heading" id="crew-lens-heading">
        At work
      </h2>
      {busy.length ? (
        <div className="crew-lens-rows">
          {busy.map((row) => (
            <LensRow key={row.roleId} row={row} narrow={narrow} />
          ))}
        </div>
      ) : null}
      <LensIdle rows={rows.filter((row) => row.idle)} />
    </section>
  );
};
