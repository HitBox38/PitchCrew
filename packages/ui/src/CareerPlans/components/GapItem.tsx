import type { CareerGap, CareerPlan } from '@pitchcrew/core';
import { Button } from '@/components/ui/button/components/Button.tsx';
import { FormSelect } from '@/FormSelect/index.tsx';
import { gapKinds, planProgress } from '@/lib/application-quality.ts';
import { GapSources } from './GapSources.tsx';

export const GapItem = ({
  plan,
  gap,
  change,
  working,
}: {
  plan: CareerPlan;
  gap: CareerGap;
  change: (data: Record<string, unknown>) => Promise<unknown>;
  working: boolean;
}) => {
  const active = plan.gaps.filter((g) => g.active).map((g) => g.id);
  const update = (data: Record<string, unknown>) =>
    void change({ id: plan.id, revision: plan.revision, ...data }).catch(() => {});
  return (
    <section className="space-y-2 border-b border-border py-4">
      <h4 className="font-semibold">
        {gap.label}
        {gap.active ? ' (active priority)' : ''}
      </h4>
      <p className="quiet">{gapKinds[gap.kind]}</p>
      {gap.supportedInLatestAnalysis === false ? (
        <p className="text-ochre">
          Not reported in the latest analysis. Your chosen priority and progress are retained.
        </p>
      ) : null}
      <p>{gap.rationale}</p>
      <p>
        <strong>Next step: </strong>
        {gap.nextStep}
      </p>
      <p>
        <strong>Completion check: </strong>
        {gap.completionCriterion}
      </p>
      <div className="flex flex-wrap items-end gap-2">
        <Button
          disabled={working || (!gap.active && active.length >= 3)}
          onClick={() =>
            update({
              action: 'plan_priorities',
              gapIds: gap.active ? active.filter((id) => id !== gap.id) : [...active, gap.id],
            })
          }
        >
          {gap.active ? 'Remove priority' : 'Make active'}
        </Button>
        <FormSelect
          label={`Progress for ${gap.label}`}
          value={gap.progress}
          disabled={working}
          onValueChange={(progress) => update({ action: 'plan_progress', gapId: gap.id, progress })}
          options={Object.entries(planProgress).map(([value, label]) => ({ value, label }))}
        />
        {gap.kind === 'evidence' ? (
          <Button
            disabled={working}
            onClick={() => update({ action: 'plan_gap_kind', gapId: gap.id, kind: 'skill' })}
          >
            Confirm I need to learn this
          </Button>
        ) : null}
      </div>
      {gap.progressSource ? <p className="quiet">User report: {gap.progressSource.quote}</p> : null}
      <GapSources sources={gap.sources} />
    </section>
  );
};
