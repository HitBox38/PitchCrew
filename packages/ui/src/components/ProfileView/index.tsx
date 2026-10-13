import { DiscardChanges } from '@/components/DiscardChanges/index.tsx';
import { ProfileEditor } from './components/ProfileEditor.tsx';
import { ProfileLocation } from './components/ProfileLocation.tsx';
import { ProfileNotes } from './components/ProfileNotes.tsx';
import { ProfileDocumentTabs } from './components/ProfileDocumentTabs.tsx';
import { ProfileWorkspaceHeading } from './components/ProfileWorkspaceHeading.tsx';
import { ProfileSourcesPanel } from './components/ProfileSourcesPanel.tsx';
import { Tabs, TabsContent } from '@/components/ui/tabs/index.tsx';
import { Button } from '@/components/ui/button/components/Button.tsx';
import { useProfileView } from './hooks/useProfileView.ts';
import { useProfileWorkspace } from './hooks/useProfileWorkspace.ts';
import type { ProfileViewProps } from './types.ts';
import { FileText, Plus } from 'lucide-react';

export function ProfileView(props: ProfileViewProps) {
  const controller = useProfileView(props);
  const workspace = useProfileWorkspace(controller);
  return (
    <>
      <section className="profile-workspace" aria-label="Profile workspace">
        <ProfileWorkspaceHeading controller={controller} workspace={workspace} />
        <div
          className={`profile-workspace-body ${workspace.explorerVisible ? '' : 'explorer-hidden'}`}
        >
          <ProfileNotes
            {...controller}
            openNote={workspace.openNote}
            createNote={workspace.createNote}
            hidden={!workspace.explorerVisible}
          />
          <Tabs
            value={controller.activeId}
            onValueChange={(id) => {
              if (typeof id === 'string') workspace.selectNote(id);
            }}
            className="profile-document"
          >
            <ProfileDocumentTabs {...controller} />
            {controller.documents.map((document) => (
              <TabsContent key={document.id} value={document.id} className="profile-note-panel">
                <ProfileEditor {...controller} />
              </TabsContent>
            ))}
            {!controller.documents.length ? (
              <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-3 p-5 text-center">
                <FileText size={28} className="text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  Open a note from the explorer, or start a new one.
                </p>
                <Button className="button small" onClick={() => void workspace.createNote()}>
                  <Plus size={14} /> New note
                </Button>
              </div>
            ) : null}
          </Tabs>
        </div>
        <ProfileLocation {...controller} />
      </section>
      <ProfileSourcesPanel {...controller} />
      <DiscardChanges guard={controller.guard} />
    </>
  );
}
