import type { JobActionsProps } from '../types.ts';
import { JobActionFooter } from './JobActionFooter.tsx';
import { OutcomeChoices } from './OutcomeChoices.tsx';
import { jobNextAction } from '../next-action.ts';
import { jobDock, pendingQuestion } from '../dock.ts';
import { QuestionDock } from './QuestionDock.tsx';
import { Button } from '@pitchcrew/design-system/button';
import { LoaderCircle } from 'lucide-react';

/** The dock's buttons come from the same decision as its sentence: one glaze at most. */
export const JobActions = (model: JobActionsProps) => {
  const next = jobNextAction(model);
  const dock = jobDock(model, next);
  const spinning = !!model.work.pending || (model.work.starting && model.work.spinning);
  const { question } = next.kind === 'waiting' ? pendingQuestion(model) : {};
  if (question) return <QuestionDock model={model} next={next} dock={dock} question={question} />;
  return (
    <JobActionFooter dock={dock} spinning={spinning}>
      {next.alternates?.map((alternate) => (
        <Button
          key={alternate.label}
          variant={alternate.quiet ? 'ghost' : 'outline'}
          disabled={
            alternate.quiet && !alternate.acts
              ? alternate.disabled
              : model.busy || model.working || alternate.disabled
          }
          onClick={alternate.perform}
        >
          {alternate.label}
        </Button>
      ))}
      {next.choices ? (
        <OutcomeChoices
          label={next.label}
          choices={next.choices}
          disabled={model.working || Boolean(model.run)}
        />
      ) : (
        <Button
          variant={next.quiet ? 'ghost' : next.secondary ? 'outline' : 'default'}
          aria-busy={spinning}
          disabled={model.working || next.disabled}
          onClick={next.perform}
        >
          {spinning ? (
            <LoaderCircle
              size={14}
              className="spin motion-reduce:animate-none"
              aria-hidden="true"
            />
          ) : null}
          {next.label}
        </Button>
      )}
    </JobActionFooter>
  );
};
