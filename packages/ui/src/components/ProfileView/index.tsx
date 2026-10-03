import { DiscardChanges } from '@/components/DiscardChanges/index.tsx';
import { ProfileLocation } from '@/components/ProfileView/components/ProfileLocation.tsx';
import { ProfileNotes } from '@/components/ProfileView/components/ProfileNotes.tsx';
import { useProfileView } from '@/components/ProfileView/hooks/useProfileView.ts';
import type { ProfileViewProps } from '@/components/ProfileView/types.ts';
import { Button } from '@/components/ui/button/components/Button.tsx';
import { Input } from '@/components/ui/input/components/Input.tsx';
import { Textarea } from '@/components/ui/textarea/components/Textarea.tsx';
import { FileText } from 'lucide-react';
import { ProfileOrigin } from './components/ProfileOrigin.tsx';
import { ProfileSources } from '@/components/ProfileSources/index.tsx';

export function ProfileView(props: ProfileViewProps) {
  const controller = useProfileView(props);
  const { data, working, name, setName, content, setContent, error, save, dirty, guard } =
    controller;
  return (
    <>
      <ProfileSources {...controller.sourceController} />
      <div className="profile-layout">
        <section className="profile-editor">
          <ProfileOrigin {...controller} />
          <form onSubmit={(e) => void save(e)}>
            <div className="profile-editor-heading">
              <FileText size={18} />
              <label className="sr-only" htmlFor="profile-file">
                Profile filename
              </label>
              <Input
                id="profile-file"
                autoComplete="off"
                name="filename"
                spellCheck={false}
                value={name}
                onChange={(e) => setName(e.target.value)}
                pattern="[a-zA-Z0-9_.\-]+\.md"
                maxLength={100}
                required
              />
              <output className="profile-save-state">
                {dirty
                  ? 'Unsaved changes'
                  : data.profile.some((file) => file.name === name)
                    ? 'Saved'
                    : 'New note'}
              </output>
              <Button type="submit" className="button primary small" disabled={working}>
                {working ? 'Saving…' : 'Save note'}
              </Button>
            </div>
            <label className="sr-only" htmlFor="profile-content">
              Profile Markdown
            </label>
            <Textarea
              id="profile-content"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              spellCheck
              rows={19}
              maxLength={50000}
            />
            {error ? (
              <p className="form-error" role="alert">
                {error}
              </p>
            ) : null}
          </form>
        </section>
        <ProfileNotes {...controller} />
      </div>
      <ProfileLocation {...controller} />
      <DiscardChanges guard={guard} />
    </>
  );
}
