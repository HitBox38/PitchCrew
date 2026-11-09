import type { JobActionsProps } from '../types.ts';
import { JobActionFooter } from './JobActionFooter.tsx';
import { jobNextAction } from '../next-action.ts';
import { Button } from '@pitchcrew/design-system/button';
import { LoaderCircle } from 'lucide-react';
import { runtimeLabels } from '@/lib/labels.ts';

export const JobActions = (model: JobActionsProps) => {
  const next = jobNextAction(model);
  const role = next.roleId ? model.data.roles.find((role) => role.id === next.roleId) : null;
  const spinning = !!model.work.pending || (model.work.starting && model.work.spinning);
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
      {next.alternates?.map((alternate) => (
        <Button
          key={alternate.label}
          variant="outline"
          disabled={model.busy || model.working || alternate.disabled}
          onClick={alternate.perform}
        >
          {alternate.label}
        </Button>
      ))}
      <Button
        variant={next.secondary ? 'outline' : 'default'}
        aria-busy={spinning}
        disabled={model.working || next.disabled}
        onClick={next.perform}
      >
        {spinning ? (
          <LoaderCircle size={14} className="spin motion-reduce:animate-none" aria-hidden="true" />
        ) : null}
        {next.label}
      </Button>
    </JobActionFooter>
  );
};
