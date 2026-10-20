import { Button } from '@/components/ui/button/components/Button.tsx';
import { useCareerPlans } from './hooks/useCareerPlans.ts';
import { PlanCreate } from './components/PlanCreate.tsx';
import { PlanCard } from './components/PlanCard.tsx';

export const CareerPlans = () => {
  const model = useCareerPlans();
  return (
    <section className="space-y-4" aria-labelledby="career-plans-heading">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="career-plans-heading">Career action plans</h2>
        <Button onClick={() => model.setCreating(true)}>Create a plan</Button>
      </div>
      <p className="quiet max-w-prose">
        Choose the jobs you want to target. Career Coach can identify recurring gaps and suggest
        next steps. Keep up to three priorities active in each plan.
      </p>
      {!model.plans.length ? (
        <p className="quiet">
          Start with a target role, a tag or selected jobs. Your plan and progress stay here across
          conversations.
        </p>
      ) : null}
      {model.plans.map((plan) => (
        <PlanCard
          key={plan.id}
          plan={plan}
          change={model.change}
          discuss={() => void model.discuss(plan).catch(() => {})}
          working={model.working}
          canDiscuss={
            !!model.coach?.enabled &&
            !!model.coach.capabilities?.manageCareerPlans &&
            !!model.coach.capabilities?.readApplications
          }
        />
      ))}
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
