import type { CareerGap } from '@pitchcrew/core';
import { planProgress } from '@/lib/application-quality.ts';

/** Up to three active priorities; a completed (user-reported) one carries a moss bead. */
export const PlanPriorities = ({ gaps }: { gaps: CareerGap[] }) => {
  const active = gaps.filter((gap) => gap.active);
  return (
    <div className="career-plan-priorities">
      <p className="career-plan-label">
        Priorities <span className="ui-count">{active.length} of 3</span>
      </p>
      {active.length ? (
        <ol>
          {active.map((gap) => (
            <li key={gap.id} data-progress={gap.progress}>
              <span className="career-plan-bead" aria-hidden="true" />
              <span className="career-plan-gap">{gap.label}</span>
              <span className="career-plan-progress">{planProgress[gap.progress]}</span>
            </li>
          ))}
        </ol>
      ) : (
        <p className="career-plan-note">
          {gaps.length ? 'Make up to three gaps active below.' : 'No gaps analyzed yet.'}
        </p>
      )}
    </div>
  );
};
