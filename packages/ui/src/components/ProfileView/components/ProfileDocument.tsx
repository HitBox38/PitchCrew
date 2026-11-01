import { useState } from 'react';
import { PanelLeft } from 'lucide-react';
import { Tabs } from '@/components/ui/tabs/index.tsx';
import { Button } from '@/components/ui/button/components/Button.tsx';
import { MarkdownModeTabs } from '@/components/MarkdownEditor/components/MarkdownModeTabs.tsx';
import type { ProfileSectionProps } from '../types.ts';
import { ProfileDocumentTabs } from './ProfileDocumentTabs.tsx';
import { ProfileEditor } from './ProfileEditor.tsx';
import { ProfileEmpty } from './ProfileEmpty.tsx';

/** Open-note tabs and the Write | Preview segment share one row above the document sheet. */
export const ProfileDocument = (props: ProfileSectionProps) => {
  const { controller: c, workspace } = props;
  const [mode, setMode] = useState('write');
  const open = workspace.explorerVisible;
  return (
    <Tabs
      value={mode}
      onValueChange={(value) => {
        if (value === 'write' || value === 'preview') setMode(value);
      }}
      className="profile-document"
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
          <ProfileDocumentTabs {...c} />
        </Tabs>
        {c.documents.length ? <MarkdownModeTabs label="Note editor mode" /> : null}
      </div>
      {c.activeId ? <ProfileEditor key={c.activeId} {...props} /> : <ProfileEmpty {...props} />}
    </Tabs>
  );
};
