import { ProfileLocation } from '@/components/ProfileView/components/ProfileLocation.tsx';
import { ProfileNotes } from '@/components/ProfileView/components/ProfileNotes.tsx';
import { useProfileView } from '@/components/ProfileView/hooks/useProfileView.ts';
import type { ProfileViewProps } from '@/components/ProfileView/types.ts';
import { Button } from '@/components/ui/button/components/Button.tsx';
import { Input } from '@/components/ui/input/components/Input.tsx';
import { Textarea } from '@/components/ui/textarea/components/Textarea.tsx';
import { FileText } from 'lucide-react';

export function ProfileView(props: ProfileViewProps) {
  const controller = useProfileView(props);
  const { working, name, setName, content, setContent, error, save } = controller;
  return (
    <>
      <div className="profile-layout">
        <section className="profile-editor">
          <form onSubmit={(e) => void save(e)}>
            <div className="profile-editor-heading">
              <FileText size={18} />
              <label className="sr-only" htmlFor="profile-file">
                Profile filename
              </label>
              <Input
                id="profile-file"
                value={name}
                onChange={(e) => setName(e.target.value)}
                pattern="[a-zA-Z0-9_.\-]+\.md"
                maxLength={100}
                required
              />
              <Button type="submit" className="button primary small" disabled={working}>
                Save
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
    </>
  );
}
