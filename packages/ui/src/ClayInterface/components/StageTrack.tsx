import type { CardState } from '@pitchcrew/core';
import { trackBeads, trackSteps } from '../helpers.ts';

type StageTrackProps = {
  state: CardState;
  /** An agent is executing on this job right now: the current bead turns plum and live. */
  live?: boolean;
  /** `ochre` when the job waits on the user; any other value leaves the bead to `live`. */
  tone?: 'plum' | 'ochre';
  size?: 'sm' | 'md';
  labelled?: boolean;
};

/**
 * The job's workflow as beads: completed steps primary, later steps empty sockets, and the current
 * step ochre when the user is asked (or must approve), plum only while an agent works, otherwise a
 * neutral raised bead with a primary ring.
 */
export const StageTrack = ({ state, live, tone, size = 'sm', labelled }: StageTrackProps) => {
  const beads = trackBeads(state);
  const current = beads.indexOf('current');
  const step = trackSteps[current];
  const currentTone =
    tone === 'ochre' ? 'ochre' : live ? 'plum' : step?.id === 'approve' ? 'ochre' : 'current';
  const label =
    current === -1 ? 'Closed' : `Stage ${current + 1} of ${trackSteps.length}: ${step?.label}`;
  return (
    <div className="clay-stage-track" data-labelled={labelled ? '' : undefined}>
      <span className="sr-only">{label}</span>
      <div className="clay-track" aria-hidden="true">
        {beads.map((bead, index) => (
          <span
            key={trackSteps[index]?.id}
            className="clay-bead"
            data-size={
              bead === 'current' && size === 'md' ? 'lg' : size === 'sm' ? 'sm' : undefined
            }
            data-tone={bead === 'done' ? 'done' : bead === 'current' ? currentTone : undefined}
            data-empty={bead === 'todo' ? '' : undefined}
            data-live={bead === 'current' && live && currentTone === 'plum' ? '' : undefined}
          />
        ))}
      </div>
      {labelled ? (
        <div className="clay-stage-labels" aria-hidden="true">
          {trackSteps.map((item, index) => (
            <span key={item.id} data-current={index === current ? '' : undefined}>
              {item.label}
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
};
