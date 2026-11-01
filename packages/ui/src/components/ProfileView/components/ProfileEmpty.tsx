import { FileUp, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button/components/Button.tsx';
import type { ProfileSectionProps } from '../types.ts';

/** Shown when every tab is closed: one line and the two ways to add background. */
export const ProfileEmpty = ({ controller: c, tree, workspace }: ProfileSectionProps) => {
  return (
    <div className="profile-sheet profile-empty">
      <p>{c.data.profile.length ? 'Open a note from the list.' : 'Add your background.'}</p>
      <div className="flex flex-wrap justify-center gap-2">
        <Button
          size="sm"
          disabled={c.working}
          onClick={() => {
            void workspace.createNote(tree.selectedFolder).then((opened) => {
              if (opened) tree.reveal(tree.selectedFolder);
            });
          }}
        >
          <Plus aria-hidden="true" /> New note
        </Button>
        <Button variant="outline" size="sm" onClick={() => c.setSourcesOpen(true)}>
          <FileUp aria-hidden="true" /> Import a document
        </Button>
      </div>
    </div>
  );
};
