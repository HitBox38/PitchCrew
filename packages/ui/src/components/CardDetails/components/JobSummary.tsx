import { JobActions } from './JobActions.tsx';
import { JobHeading } from './JobHeading.tsx';
import { JobMetadata } from './JobMetadata.tsx';
import { JobState } from './JobState.tsx';
import type { CardDetailsModel } from '../types.ts';
import { runtimeLabels } from '@/lib/labels.ts';

export function JobSummary(controller: CardDetailsModel) {
  const { data, runRole, failed, run } = controller;
  const role = data.roles.find((entry) => entry.id === runRole);
  return (
    <div className="job-summary shrink-0 overflow-y-auto px-5 pt-4 pb-3 max-mobile:px-4">
      <JobHeading {...controller} />
      <JobMetadata {...controller} />
      <JobState {...controller} />
      <JobActions {...controller} />
      {role ? (
        <p className="action-hint">
          Uses {runtimeLabels[role.runtime]}.{' '}
          {role.runtime === 'demo' ? 'No AI calls.' : 'Starting a run uses your CLI account.'}
        </p>
      ) : null}
      {failed && !run ? <p className="form-error">Last run: {failed.message}</p> : null}
    </div>
  );
}
