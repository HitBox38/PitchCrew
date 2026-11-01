import { Link } from '@tanstack/react-router';
import { Lightbulb, GitBranch, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button/components/Button.tsx';
import { buttonVariants } from '@/components/ui/button/constants.ts';
import { useWorkspaceStore } from '@/WorkspaceStore/index.ts';
import { WorkspaceHeaderPrimary } from '@/App/components/WorkspacePage.tsx';
import type { ProfileSectionProps } from '../types.ts';

export const ProfileTitle = ({ controller: c, tree, workspace }: ProfileSectionProps) => {
  const ready = useWorkspaceStore((state) => !!state.profileSources.preview);
  const reviews = c.sourceController.proposals.length + (ready ? 1 : 0);
  const folder = tree.selectedFolder;
  return (
    <header className="ui-title-row profile-title-row">
      <h1>Profile</h1>
      <span className="ui-title-fact max-mobile:hidden">
        What your crew is allowed to say about you
      </span>
      <div className="ui-title-actions">
        <Link
          to="/insights"
          data-slot="button"
          className={buttonVariants({ variant: 'outline', size: 'sm' })}
        >
          <Lightbulb aria-hidden="true" /> Insights
        </Link>
        <Button
          variant="outline"
          size="sm"
          className="profile-sources-action"
          onClick={() => c.setSourcesOpen(true)}
          aria-haspopup="dialog"
          aria-label={reviews ? `Sources, ${reviews} waiting for review` : 'Sources'}
        >
          <GitBranch aria-hidden="true" /> Sources
          {reviews ? (
            <span className="profile-review-count" aria-hidden="true">
              {reviews}
            </span>
          ) : null}
        </Button>
        <WorkspaceHeaderPrimary>
          <Button
            size="sm"
            disabled={c.working}
            title={`New note in ${folder || 'your profile folder'}`}
            onClick={() => {
              void workspace.createNote(folder).then((opened) => {
                if (opened) tree.reveal(folder);
              });
            }}
          >
            <Plus aria-hidden="true" /> New note
          </Button>
        </WorkspaceHeaderPrimary>
      </div>
    </header>
  );
};
