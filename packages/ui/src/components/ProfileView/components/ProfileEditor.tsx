import { useState } from 'react';
import type { ProfileViewModel } from '../types.ts';
import { ProfileOrigin } from './ProfileOrigin.tsx';
import { ProfileEditorHeading } from './ProfileEditorHeading.tsx';
import { Tabs } from '@/components/ui/tabs/index.tsx';
import { MarkdownEditor } from '@/components/MarkdownEditor/index.tsx';
import { MarkdownStatus } from '@/components/MarkdownEditor/components/MarkdownStatus.tsx';
import { useMarkdownSaveShortcut } from '@/components/MarkdownEditor/hooks/useMarkdownSaveShortcut.ts';

export function ProfileEditor(c: ProfileViewModel) {
  const [mode, setMode] = useState('write');
  const form = useMarkdownSaveShortcut();
  return (
    <form className="profile-editor" ref={form} onSubmit={(event) => void c.save(event)}>
      <Tabs
        value={mode}
        onValueChange={(value) => {
          if (value === 'write' || value === 'preview') setMode(value);
        }}
        className="profile-editor-modes"
      >
        <ProfileEditorHeading {...c} />
        <ProfileOrigin {...c} />
        <MarkdownEditor
          id="profile-content"
          label="Profile Markdown"
          content={c.content}
          onChange={c.setContent}
          maxLength={50000}
        />
      </Tabs>
      {c.error ? (
        <p className="form-error px-4 py-2" role="alert">
          {c.error}
        </p>
      ) : null}
      <MarkdownStatus
        content={c.content}
        status={
          c.dirty
            ? 'Unsaved changes'
            : c.data.profile.some((file) => file.name === c.name)
              ? 'Saved'
              : 'New note'
        }
      />
    </form>
  );
}
