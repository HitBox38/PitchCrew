import type { CardState } from '@pitchcrew/core';
import { trackBeads, trackSteps } from '../helpers.ts';

type StageTrackProps = {
  state: CardState;
  /** Mark the current bead as live while an agent works on this job. */
  live?: boolean;
  /** Tone of the current bead: ochre when the user needs to act. */
  tone?: 'plum' | 'ochre';
  size?: 'sm' | 'md';
  labelled?: boolean;
};

export const StageTrack = ({
  state,
  live,
  tone = 'plum',
  size = 'sm',
  labelled,
}: StageTrackProps) => {
  const beads = trackBeads(state);
  const current = beads.indexOf('current');
  const label =
    current === -1
      ? 'Closed'
      : `Stage ${current + 1} of ${trackSteps.length}: ${trackSteps[current]?.label}`;
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
            data-tone={bead === 'done' ? 'done' : bead === 'current' ? tone : undefined}
            data-live={bead === 'current' && live ? '' : undefined}
          />
        ))}
      </div>
      {labelled ? (
        <div className="clay-stage-labels" aria-hidden="true">
          {trackSteps.map((step, index) => (
            <span key={step.id} data-current={index === current ? '' : undefined}>
              {step.label}
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
};
