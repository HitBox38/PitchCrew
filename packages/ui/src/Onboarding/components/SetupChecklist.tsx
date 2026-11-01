import type { Snapshot } from '@pitchcrew/core';
import { Button } from '@pitchcrew/design-system/button';
import { useWorkspaceNavigation } from '@/workspace-navigation.ts';
import { useWorkspaceStore } from '@/WorkspaceStore/index.ts';
import { missingSeats, setupProgress } from '../helpers.ts';
import type { OnboardingActions } from '../types.ts';
import { SetupItem } from './SetupItem.tsx';

/** Three real requirements with one next step each; finishing appears only once all pass. */
export const SetupChecklist = ({
  data,
  working,
  error,
  save,
}: OnboardingActions & { data: Snapshot }) => {
  const { go } = useWorkspaceNavigation();
  const setAdd = useWorkspaceStore((state) => state.setAdd);
  const progress = setupProgress(data);
  const count = Object.values(progress).filter(Boolean).length;
  const current = !progress.profile ? 'profile' : !progress.crew ? 'crew' : 'job';
  const missing = missingSeats(data);
  return (
    <section className="onboarding-checklist" aria-labelledby="setup-title">
      <header className="onboarding-checklist-heading">
        <h2 id="setup-title">Make this workspace yours</h2>
        <output>{count} of 3 ready</output>
      </header>
      <ol>
        <SetupItem
          title="Add your background"
          description="A profile note with your experience and goals."
          done={progress.profile}
          current={current === 'profile'}
          label="Add profile"
          action={() => go('profile')}
          disabled={working}
        />
        <SetupItem
          title="Set up your crew"
          description={
            missing.length
              ? `Needs an enabled, installed ${missing.join(', ')}.`
              : 'Scout, Writer and Reviewer are ready.'
          }
          done={progress.crew}
          current={current === 'crew'}
          label="Set up crew"
          action={() => go('crew')}
          disabled={working}
        />
        <SetupItem
          title="Bring your first job"
          description="A real job post you’re considering."
          done={progress.job}
          current={current === 'job' && !progress.job}
          label="Add a job"
          action={() => (progress.job ? go('board') : setAdd(true))}
          disabled={working}
        />
      </ol>
      <footer className="onboarding-checklist-footer">
        {count === 3 ? (
          <Button size="sm" disabled={working} onClick={() => void save('completed')}>
            {working ? 'Saving…' : 'Finish setup'}
          </Button>
        ) : (
          <Button
            variant="ghost"
            size="sm"
            disabled={working}
            onClick={() => void save('dismissed')}
          >
            {working ? 'Saving…' : 'Set up later'}
          </Button>
        )}
      </footer>
      {error ? (
        <p className="form-error" role="alert">
          {error}
        </p>
      ) : null}
    </section>
  );
};
