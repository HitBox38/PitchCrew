import { DiscardChanges } from '@/components/DiscardChanges/index.tsx';
import { ProfileNotes } from './components/ProfileNotes.tsx';
import { ProfileTitle } from './components/ProfileTitle.tsx';
import { ProfileNotices } from './components/ProfileNotices.tsx';
import { ProfileDocument } from './components/ProfileDocument.tsx';
import { ProfileCitations } from './components/ProfileCitations.tsx';
import { ProfileSourcesPanel } from './components/ProfileSourcesPanel.tsx';
import { useProfileView } from './hooks/useProfileView.ts';
import { useProfileNotes } from './hooks/useProfileNotes.ts';
import { useProfileWorkspace } from './hooks/useProfileWorkspace.ts';
import type { ProfileViewProps } from './types.ts';
import { useNewNoteRequest } from '@/lib/new-note.ts';

export const ProfileView = (props: ProfileViewProps) => {
  const controller = useProfileView(props);
  const tree = useProfileNotes(controller);
  const workspace = useProfileWorkspace(controller);
  const sections = { controller, tree, workspace };
  // New note from the sidebar's New menu or the command palette lands here.
  useNewNoteRequest(() => workspace.createNote());
  return (
    <>
      <section className="profile-workspace" aria-label="Profile workspace">
        <ProfileTitle {...sections} />
        <ProfileNotices {...controller} />
        <div className="profile-body" data-explorer={workspace.explorerVisible ? 'open' : 'closed'}>
          <ProfileNotes {...sections} />
          <ProfileDocument {...sections} />
          <ProfileCitations data={controller.data} activeSavedName={controller.activeSavedName} />
        </div>
      </section>
      <ProfileSourcesPanel {...controller} />
      <DiscardChanges guard={controller.guard} />
    </>
  );
};
