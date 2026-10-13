import { lazy, Suspense, useState } from 'react';
import type { ProfileViewModel } from '../types.ts';
import { ProfileOrigin } from './ProfileOrigin.tsx';
import { ProfileEditorHeading } from './ProfileEditorHeading.tsx';
import { Textarea } from '@/components/ui/textarea/components/Textarea.tsx';
import { Tabs, TabsContent } from '@/components/ui/tabs/index.tsx';
import { useProfileSaveShortcut } from '../hooks/useProfileSaveShortcut.ts';

const ProfilePreview = lazy(() => import('./ProfilePreview.tsx'));

export function ProfileEditor(c: ProfileViewModel) {
  const [mode, setMode] = useState('write');
  const form = useProfileSaveShortcut();
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
        <TabsContent value="write" keepMounted className="profile-write-panel">
          <label className="sr-only" htmlFor="profile-content">
            Profile Markdown
          </label>
          <Textarea
            id="profile-content"
            value={c.content}
            onChange={(event) => c.setContent(event.target.value)}
            spellCheck
            maxLength={50000}
          />
        </TabsContent>
        <TabsContent value="preview" className="profile-preview-panel">
          <Suspense fallback={<p className="quiet">Opening preview…</p>}>
            <ProfilePreview content={c.content} />
          </Suspense>
        </TabsContent>
      </Tabs>
      {c.error ? (
        <p className="form-error px-4 py-2" role="alert">
          {c.error}
        </p>
      ) : null}
      <footer className="profile-editor-status">
        <output className="profile-save-state" aria-live="polite">
          {c.dirty
            ? 'Unsaved changes'
            : c.data.profile.some((file) => file.name === c.name)
              ? 'Saved'
              : 'New note'}
        </output>
        <span className="ml-auto">
          {c.content.trim() ? c.content.trim().split(/\s+/u).length : 0} words
        </span>
        <span>Markdown</span>
      </footer>
    </form>
  );
}
