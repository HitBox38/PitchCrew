import { StatusDropTarget } from './StatusDropTarget.tsx';
import { dropStages } from '@/board-stages.ts';
import type { Card, Snapshot } from '@pitchcrew/core';

/** While a closed job is dragged: every exact status, grouped by column, as a drop target. */
export const StatusDestinations = ({
  active,
  data,
  working,
}: {
  active: Card;
  data: Snapshot;
  working: boolean;
}) => (
  <div className="clay-destinations" aria-label="Move to a status">
    {dropStages.map((stage) => (
      <section key={stage.id} className="clay-destination" aria-label={stage.label}>
        <h2>{stage.label}</h2>
        <div className="clay-column-targets">
          {stage.states.map((state) => (
            <StatusDropTarget
              key={state}
              state={state}
              active={active}
              data={data}
              working={working}
            />
          ))}
        </div>
      </section>
    ))}
  </div>
);
