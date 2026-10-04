import type { Snapshot } from '@pitchcrew/core';
import { Link } from '@tanstack/react-router';
import { Button } from '@/components/ui/button/components/Button.tsx';
import { useWorkspaceNavigation } from '@/workspace-navigation.ts';
import { useWorkspaceStore } from '@/WorkspaceStore/index.ts';
import { setupProgress } from '../helpers.ts';
import type { OnboardingActions } from '../types.ts';
import { SetupItem } from './SetupItem.tsx';

export function SetupChecklist({
  data,
  working,
  error,
  save,
}: OnboardingActions & { data: Snapshot }) {
  const { go } = useWorkspaceNavigation();
  const setAdd = useWorkspaceStore((state) => state.setAdd);
  const progress = setupProgress(data);
  const count = Object.values(progress).filter(Boolean).length;
  return (
    <section className="onboarding-checklist mb-7 max-w-210" aria-labelledby="setup-title">
      <header className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="setup-title" className="font-serif text-2xl">
            {count === 3 ? 'Your crew is ready to begin.' : 'Make this workspace yours.'}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {count === 3
              ? 'Open your job and ask Scout to evaluate the fit.'
              : 'A few saved details give the crew somewhere to start.'}
          </p>
        </div>
        <output className="text-sm text-muted-foreground">{count} of 3 ready</output>
      </header>
      <ol>
        <SetupItem
          title="Add your background"
          description="Save a profile note with your experience, projects and job preferences. You can also import existing notes."
          done={progress.profile}
          label="Add profile"
          action={() => go('profile')}
          disabled={working}
        />
        <SetupItem
          title="Set up your crew"
          description="In Crew, choose an installed runtime for Scout, Writer and Reviewer, then enable each agent. Sign in through the runtime’s own CLI first."
          done={progress.crew}
          label="Set up crew"
          action={() => go('crew')}
          disabled={working}
        />
        <SetupItem
          title="Bring your first job"
          description="Add a real job post you’re considering. Keep its description so the crew can assess it."
          done={progress.job}
          label="Add job"
          action={() => (progress.job ? go('board') : setAdd(true))}
          disabled={working}
        />
      </ol>
      <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
        <p className="text-sm text-muted-foreground">
          Connections,{' '}
          <Link to="/skills" className="text-primary underline underline-offset-4">
            skills
          </Link>{' '}
          and routines can wait.
        </p>
        <Button
          className={count === 3 ? 'button primary small' : 'button ghost small'}
          disabled={working}
          onClick={() => void save(count === 3 ? 'completed' : 'dismissed')}
        >
          {working ? 'Saving…' : count === 3 ? 'Finish setup' : 'Set up later'}
        </Button>
      </footer>
      {error ? (
        <p className="form-error mt-3" role="alert">
          {error}
        </p>
      ) : null}
    </section>
  );
}
