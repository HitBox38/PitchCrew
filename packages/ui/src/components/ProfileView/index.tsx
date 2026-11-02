import { DiscardChanges } from '@/components/DiscardChanges/index.tsx';
import { ProfileNotes } from './components/ProfileNotes.tsx';
import { ProfileTitle } from './components/ProfileTitle.tsx';
import { ProfileNotices } from './components/ProfileNotices.tsx';
import { ProfileDocument } from './components/ProfileDocument.tsx';
import { ProfileResizer } from './components/ProfileResizer.tsx';
import { ProfileCitations } from './components/ProfileCitations.tsx';
import { ProfileSourcesPanel } from './components/ProfileSourcesPanel.tsx';
import { useProfileView } from './hooks/useProfileView.ts';
import { useProfileNotes } from './hooks/useProfileNotes.ts';
import { useProfileWorkspace } from './hooks/useProfileWorkspace.ts';
import { useProfileCitations } from './hooks/useProfileCitations.ts';
import type { ProfileViewProps } from './types.ts';
import { useNewNoteRequest } from '@/lib/new-note.ts';

/**
 * An editor workspace on the paper: the title row, then one frame holding the notes explorer, a
 * drag handle, the note sheet (tab band, editor, status bar) running to the frame's right edge,
 * and, when the user opens it, the citations rail.
 */
export const ProfileView = (props: ProfileViewProps) => {
  const controller = useProfileView(props);
  const tree = useProfileNotes(controller);
  const workspace = useProfileWorkspace(controller);
  const citations = useProfileCitations(controller, workspace);
  const sections = { controller, tree, workspace, citations };
  // New note from the sidebar's New menu or the command palette lands here.
  useNewNoteRequest(() => workspace.createNote());
  return (
    <>
      <section
        className="profile-workspace"
        aria-label="Profile workspace"
        style={{ ['--explorer-width' as string]: `${workspace.explorerWidth}px` }}
      >
        <ProfileTitle {...sections} />
        <ProfileNotices {...controller} />
        <div
          className="profile-body"
          data-explorer={workspace.explorerVisible ? 'open' : 'closed'}
          data-citations={citations.rail ? 'open' : 'closed'}
        >
          <ProfileNotes {...sections} />
          {workspace.explorerVisible && !workspace.mobile ? (
            <ProfileResizer workspace={workspace} />
          ) : null}
          <ProfileDocument {...sections} />
          {citations.rail ? <ProfileCitations {...sections} /> : null}
        </div>
      </section>
      <ProfileSourcesPanel {...controller} />
      <DiscardChanges guard={controller.guard} />
    </>
  );
};
