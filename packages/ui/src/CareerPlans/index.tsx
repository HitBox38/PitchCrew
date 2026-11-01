import type { CareerPlansModel } from './hooks/useCareerPlans.ts';
import { PlanCreate } from './components/PlanCreate.tsx';
import { PlanCard } from './components/PlanCard.tsx';

/** Career action plans as clay cards; Create a plan lives in the Insights title row. */
export const CareerPlans = ({ model }: { model: CareerPlansModel }) => {
  const canDiscuss =
    !!model.coach?.enabled &&
    !!model.coach.capabilities?.manageCareerPlans &&
    !!model.coach.capabilities?.readApplications;
  return (
    <section className="ui-section career-plans" aria-labelledby="career-plans-heading">
      <h2 id="career-plans-heading" className="ui-section-heading">
        Plans <span className="ui-count">{model.plans.length}</span>
      </h2>
      {model.plans.length ? (
        <div className="career-plan-grid">
          {model.plans.map((plan) => (
            <PlanCard
              key={plan.id}
              plan={plan}
              change={model.change}
              discuss={() => void model.discuss(plan).catch(() => {})}
              working={model.working}
              canDiscuss={canDiscuss}
            />
          ))}
        </div>
      ) : (
        <p className="ui-empty">
          No plan yet. Pick a target role, a tag or chosen jobs; Career Coach finds the recurring
          gaps.
        </p>
      )}
      {model.creating ? (
        <PlanCreate
          change={model.change}
          close={() => model.setCreating(false)}
          working={model.working}
        />
      ) : null}
    </section>
  );
};
