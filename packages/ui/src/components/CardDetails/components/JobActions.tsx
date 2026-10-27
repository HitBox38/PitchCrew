import type { JobActionsProps } from '../types.ts';
import { JobActionFooter } from './JobActionFooter.tsx';
import { jobNextAction } from '../next-action.ts';
import { Button } from '@/components/ui/button/components/Button.tsx';
import { LoaderCircle } from 'lucide-react';
import { runtimeLabels } from '@/lib/labels.ts';

export const JobActions = (model: JobActionsProps) => {
  const next = jobNextAction(model);
  const role = 'roleId' in next ? model.data.roles.find((role) => role.id === next.roleId) : null;
  return (
    <JobActionFooter
      failure={model.failed && !model.run ? model.failed.message : undefined}
      hint={
        <>
          {next.hint ? <p className="action-hint">{next.hint}</p> : null}
          {role ? (
            <p className="action-hint">
              {role.name} · {runtimeLabels[role.runtime]}
              {role.runtime === 'demo' ? ' · No AI calls' : ' · Uses your CLI account'}
            </p>
          ) : null}
        </>
      }
    >
      {model.card.state === 'lead' && !model.run ? (
        <Button
          aria-busy={model.work.pending?.targetState === 'shortlisted'}
          disabled={model.busy}
          variant="outline"
          onClick={() =>
            model.act(`/cards/${model.card.id}/move`, { state: 'shortlisted' }, 'Shortlisted')
          }
        >
          {model.work.pending?.targetState === 'shortlisted' ? (
            <LoaderCircle
              size={14}
              className="spin motion-reduce:animate-none"
              aria-hidden="true"
            />
          ) : null}
          {model.work.pending?.targetState === 'shortlisted' ? 'Shortlisting…' : 'Shortlist'}
        </Button>
      ) : null}
      <Button
        variant={'secondary' in next ? 'outline' : 'default'}
        aria-busy={!!model.work.pending || (model.work.starting && model.work.spinning)}
        disabled={model.working || next.disabled}
        onClick={next.perform}
      >
        {(model.work.pending && model.work.pending.targetState !== 'shortlisted') ||
        (model.work.starting && model.work.spinning) ? (
          <LoaderCircle size={14} className="spin motion-reduce:animate-none" aria-hidden="true" />
        ) : null}
        {next.label}
      </Button>
    </JobActionFooter>
  );
};
