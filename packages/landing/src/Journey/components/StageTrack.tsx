'use client';

import { Bead } from '../../components/clay/Bead';
import { stages } from '../constants';
import { useStage } from '../hooks/useStage';

/** The sticky stage track: it fills as the visitor scrolls the job through the crew. */
export const StageTrack = () => {
  const step = useStage();
  const last = stages.length - 1;
  return (
    <div className="journey-track">
      <ol className="track journey-stages" aria-label="Job stages">
        <span
          className="track-fill"
          style={{ '--fill': step.reaches / last } as React.CSSProperties}
        />
        {stages.map((stage, index) => (
          <li
            key={stage}
            className="journey-stage"
            data-current={index === step.reaches ? '' : undefined}
          >
            <Bead
              tone={
                index < step.reaches ? 'primary' : index === step.reaches ? 'current' : undefined
              }
              size={index === step.reaches ? 'lg' : undefined}
              label={index === step.reaches ? `${stage}, current stage` : stage}
            />
            <span className="journey-stage-label">{stage}</span>
          </li>
        ))}
      </ol>
    </div>
  );
};
