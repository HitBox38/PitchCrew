import type { CareerPlan } from '@pitchcrew/core';
import { AccordionSection } from '@pitchcrew/design-system/accordion';
import { Button } from '@pitchcrew/design-system/button';
import { planScope } from '../helpers.ts';
import { GapItem } from './GapItem.tsx';
import { PlanPriorities } from './PlanPriorities.tsx';

export const PlanCard = ({
  plan,
  change,
  discuss,
  working,
  canDiscuss,
}: {
  plan: CareerPlan & { stale: boolean };
  change: (data: Record<string, unknown>) => Promise<unknown>;
  discuss: () => void;
  working: boolean;
  canDiscuss: boolean;
}) => {
  return (
    <article className="ui-card career-plan" aria-labelledby={`plan-${plan.id}`}>
      <header className="career-plan-head">
        <div>
          <h3 id={`plan-${plan.id}`}>{plan.name}</h3>
          <p>{planScope(plan.scope)}</p>
        </div>
        <Button className="button small" disabled={working || !canDiscuss} onClick={discuss}>
          Analyze with Career Coach
        </Button>
      </header>
      {plan.stale ? (
        <p className="career-plan-stale">
          {plan.sourceRevision
            ? 'Source evidence changed. Refresh this analysis.'
            : 'Ready for the first analysis.'}
        </p>
      ) : null}
      {!canDiscuss ? (
        <p className="career-plan-note">
          Enable Career Coach with application reads and career plan management in Crew to analyze
          this plan.
        </p>
      ) : null}
      <PlanPriorities gaps={plan.gaps} />
      {plan.coverage ? <p className="career-plan-note">{plan.coverage}</p> : null}
      {plan.gaps.length ? (
        <AccordionSection
          heading={`${plan.gaps.length} gaps and next steps`}
          className="career-plan-gaps"
        >
          {[...plan.gaps]
            .sort((a, b) => Number(b.active) - Number(a.active))
            .map((gap) => (
              <GapItem key={gap.id} plan={plan} gap={gap} change={change} working={working} />
            ))}
        </AccordionSection>
      ) : null}
    </article>
  );
};
