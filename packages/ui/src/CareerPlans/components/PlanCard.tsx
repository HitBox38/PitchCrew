import type { CareerPlan } from '@pitchcrew/core';
import { AccordionSection } from '@/components/ui/accordion/index.tsx';
import { Button } from '@/components/ui/button/components/Button.tsx';
import { GapItem } from './GapItem.tsx';

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
    <article className="space-y-3 border-b border-border pb-5">
      <h3>{plan.name}</h3>
      <p className="quiet">
        {plan.scope.title ? `Role: ${plan.scope.title}. ` : ''}
        {plan.scope.tag ? `Tag: ${plan.scope.tag}. ` : ''}
        {plan.scope.cardIds.length ? `${plan.scope.cardIds.length} selected jobs.` : ''}
      </p>
      {plan.stale ? (
        <p className="font-semibold text-ochre">
          {plan.sourceRevision
            ? 'Source evidence changed. Refresh this analysis.'
            : 'Ready for the first analysis.'}
        </p>
      ) : null}
      <p className="quiet">{plan.coverage}</p>
      <Button disabled={working || !canDiscuss} onClick={discuss}>
        Analyze with Career Coach
      </Button>
      {!canDiscuss ? (
        <p className="quiet">
          Enable Career Coach with application reads and career plan management in Crew to analyze
          this plan.
        </p>
      ) : null}
      <AccordionSection heading={`${plan.gaps.length} gaps and next steps`} defaultOpen>
        <p className="quiet">{plan.gaps.filter((g) => g.active).length} of 3 active priorities</p>
        {[...plan.gaps]
          .sort((a, b) => Number(b.active) - Number(a.active))
          .map((gap) => (
            <GapItem key={gap.id} plan={plan} gap={gap} change={change} working={working} />
          ))}
      </AccordionSection>
    </article>
  );
};
