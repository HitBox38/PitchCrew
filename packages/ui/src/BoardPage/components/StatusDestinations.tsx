import { StatusDropTarget } from './StatusDropTarget.tsx';
import { dropStages } from '@/board-stages.ts';
import type { Card, CardState, Snapshot } from '@pitchcrew/core';

export function StatusDestinations({
  active,
  data,
  working,
  selection,
}: {
  active: Card;
  data: Snapshot;
  working: boolean;
  selection?: CardState | null;
}) {
  return (
    <div
      className="mb-1 grid shrink-0 grid-cols-[repeat(6,minmax(180px,1fr))] gap-3 overflow-x-auto p-1"
      aria-label="Move to a status"
    >
      {dropStages.map((stage) => (
        <section key={stage.id} className="pipeline-column p-3" aria-label={stage.label}>
          <h2 className="mb-2 text-sm font-semibold">{stage.label}</h2>
          <div className="flex flex-col gap-1">
            {stage.states.map((state) => (
              <StatusDropTarget
                key={state}
                state={state}
                active={active}
                data={data}
                working={working}
                selection={selection}
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
