import { DiscardChanges } from '@/components/DiscardChanges/index.tsx';
import { ProfileNotes } from './components/ProfileNotes.tsx';
import { ProfileTitle } from './components/ProfileTitle.tsx';
import { ProfileNotices } from './components/ProfileNotices.tsx';
import { ProfileDocument } from './components/ProfileDocument.tsx';
import { ProfileResizer } from './components/ProfileResizer.tsx';
import { ProfileCitations } from './components/ProfileCitations.tsx';
import { ProfileSourcesPanel } from './components/ProfileSourcesPanel.tsx';
import { ProfileNoteDialogs } from './components/ProfileNoteDialogs.tsx';
import { ProfileTrashNote } from './components/ProfileTrashNote.tsx';
import { useProfileView } from './hooks/useProfileView.ts';
import { useProfileNotes } from './hooks/useProfileNotes.ts';
import { useProfileWorkspace } from './hooks/useProfileWorkspace.ts';
import { useProfileCitations } from './hooks/useProfileCitations.ts';
import type { ProfileViewProps } from './types.ts';
import { useNewNoteRequest, useOpenNoteRequest } from '@/lib/new-note.ts';
import { useElementWidth } from '@/hooks/useElementWidth.ts';
import { useRef } from 'react';

/**
 * An editor workspace on the paper: the title row, then one frame holding the notes explorer, a
 * drag handle, the note sheet (tab band, tools, editor, status bar) running to the frame's right
 * edge, and, when the user opens it, the citations rail.
 */
export const ProfileView = (props: ProfileViewProps) => {
  const controller = useProfileView(props);
  const tree = useProfileNotes(controller);
  const workspace = useProfileWorkspace(controller);
  const citations = useProfileCitations(controller, workspace);
  const sections = { controller, tree, workspace, citations };
  const root = useRef<HTMLElement>(null);
  useElementWidth(root, workspace.setWorkspaceWidth);
  const drawer = workspace.overlay && workspace.explorerVisible;
  // New note from the sidebar's New menu or the command palette lands here.
  useNewNoteRequest(() => workspace.createNote(tree.selectedFolder));
  useOpenNoteRequest((name, find) => {
    const note = controller.data.profile.find((file) => file.name === name);
    if (note) workspace.openNote(note, find);
  });
  return (
    <>
      <section
        ref={root}
        className="profile-workspace"
        aria-label="Profile workspace"
        data-view={workspace.mobile ? (workspace.explorerVisible ? 'notes' : 'note') : undefined}
        style={{ ['--explorer-width' as string]: `${workspace.explorerWidth}px` }}
      >
        <ProfileTitle {...sections} />
        <ProfileNotices {...controller} />
        <div
          className="profile-body"
          data-explorer={workspace.explorerVisible && !drawer ? 'open' : 'closed'}
          data-drawer={drawer ? '' : undefined}
          data-citations={citations.rail ? 'open' : 'closed'}
        >
          <ProfileNotes {...sections} />
          {drawer ? (
            <button
              type="button"
              className="profile-scrim"
              aria-label="Close notes explorer"
              tabIndex={-1}
              onClick={workspace.closeOverlay}
            />
          ) : null}
          {workspace.explorerVisible && !workspace.mobile && !drawer ? (
            <ProfileResizer workspace={workspace} />
          ) : null}
          <ProfileDocument {...sections} />
          {citations.rail ? <ProfileCitations {...sections} /> : null}
          <ProfileTrashNote {...controller} />
        </div>
      </section>
      <ProfileSourcesPanel {...controller} />
      <ProfileNoteDialogs {...sections} />
      <DiscardChanges guard={controller.guard} />
    </>
  );
};
