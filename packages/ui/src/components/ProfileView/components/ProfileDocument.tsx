import { PanelLeft } from 'lucide-react';
import { Tabs } from '@pitchcrew/design-system/tabs';
import { Button } from '@pitchcrew/design-system/button';
import { MarkdownModeSwitch } from '@/components/MarkdownEditor/components/MarkdownModeSwitch.tsx';
import { MarkdownOutline } from '@/components/MarkdownEditor/components/MarkdownOutline.tsx';
import { useMarkdownSaveShortcut } from '@/components/MarkdownEditor/hooks/useMarkdownSaveShortcut.ts';
import { useElementWidth } from '@/hooks/useElementWidth.ts';
import type { ProfileSectionProps } from '../types.ts';
import { ProfileDocumentTabs } from './ProfileDocumentTabs.tsx';
import { ProfileEditor } from './ProfileEditor.tsx';
import { ProfileEmpty } from './ProfileEmpty.tsx';

/**
 * The note sheet: one band (explorer toggle, open notes, outline, Write | Split | Preview) over
 * the editor and its status bar. ⌘S saves from anywhere in the sheet.
 */
export const ProfileDocument = (props: ProfileSectionProps) => {
  const { controller: c, workspace } = props;
  const form = useMarkdownSaveShortcut();
  useElementWidth(form, workspace.setSheetWidth);
  const open = workspace.explorerVisible;
  return (
    <form
      ref={form}
      className="profile-document"
      aria-label={c.name ? `Note ${c.name}` : 'Notes'}
      onSubmit={(event) => void c.save(event)}
    >
      <div className="profile-tab-row">
        <Button
          variant="ghost"
          size="icon-sm"
          className="profile-explorer-toggle"
          aria-label={open ? 'Hide notes explorer' : 'Show notes explorer'}
          aria-expanded={open}
          aria-controls="profile-explorer"
          onClick={workspace.toggleExplorer}
        >
          <PanelLeft size={16} />
        </Button>
        <Tabs
          value={c.activeId}
          onValueChange={(id) => {
            if (typeof id === 'string') workspace.selectNote(id);
          }}
          className="profile-tabs-host"
        >
          <ProfileDocumentTabs {...props} />
        </Tabs>
        {c.activeId ? (
          <div className="profile-tab-tools">
            <MarkdownOutline
              content={c.content}
              line={workspace.cursor?.line}
              reveal={workspace.revealHeading}
            />
            <MarkdownModeSwitch
              label="Note view"
              value={workspace.mode}
              onChange={workspace.setMode}
              split={workspace.splitRoom}
            />
          </div>
        ) : null}
      </div>
      {c.activeId ? <ProfileEditor {...props} /> : <ProfileEmpty {...props} />}
    </form>
  );
};
