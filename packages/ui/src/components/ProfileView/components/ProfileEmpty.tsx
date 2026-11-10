import { FilePlus2, FileUp, NotebookPen } from 'lucide-react';
import { Button } from '@pitchcrew/design-system/button';
import type { ProfileSectionProps } from '../types.ts';

/**
 * With no note open: an empty profile explains what belongs here and offers the two ways in;
 * otherwise it points back to the explorer.
 */
export const ProfileEmpty = ({ controller: c, tree, workspace }: ProfileSectionProps) => {
  const fresh = !c.data.profile.length;
  return (
    <div className="profile-sheet profile-empty">
      <div className="profile-empty-card">
        <span className="profile-empty-orb" aria-hidden="true">
          <NotebookPen size={24} />
        </span>
        <h2>{fresh ? 'Start your profile' : 'No note open'}</h2>
        <p>
          {fresh
            ? 'Write down roles, projects and results in your own words. Your crew quotes only what is here, so every claim in an application traces back to you.'
            : 'Choose a note in the explorer, or start a new one.'}
        </p>
        <div className="profile-empty-actions">
          {/* The title row's New note is the page's one glazed action. */}
          <Button
            variant="outline"
            disabled={c.working}
            onClick={() => workspace.createNote(tree.selectedFolder)}
          >
            <FilePlus2 aria-hidden="true" /> New note
          </Button>
          {fresh ? (
            <Button variant="outline" onClick={() => c.setSourcesOpen(true)}>
              <FileUp aria-hidden="true" /> Import from GitHub or Drive
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
};
