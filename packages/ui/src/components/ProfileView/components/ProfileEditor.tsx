import type { ProfileSectionProps } from '../types.ts';
import { ProfileOrigin } from './ProfileOrigin.tsx';
import { ProfileSaveBar } from './ProfileSaveBar.tsx';
import { MarkdownEditor } from '@/components/MarkdownEditor/index.tsx';
import { useMarkdownSaveShortcut } from '@/components/MarkdownEditor/hooks/useMarkdownSaveShortcut.ts';

export const ProfileEditor = ({ controller: c, tree }: ProfileSectionProps) => {
  const form = useMarkdownSaveShortcut();
  return (
    <form
      className="profile-note-form"
      ref={form}
      aria-label={c.name || 'Untitled note'}
      onSubmit={(event) => void c.save(event)}
    >
      <div className="profile-sheet">
        <ProfileOrigin {...c} />
        <MarkdownEditor
          id="profile-content"
          label="Profile Markdown"
          content={c.content}
          onChange={c.setContent}
          maxLength={50000}
        />
      </div>
      <ProfileSaveBar
        location={tree.location(c.activeSavedName)}
        renamed={c.name !== c.activeSavedName ? c.name : ''}
        content={c.content}
        status={
          c.dirty
            ? 'Unsaved changes'
            : c.data.profile.some((file) => file.name === c.name)
              ? 'Saved'
              : 'New note'
        }
        error={c.error}
        blocker={c.blocker}
        working={c.working}
      />
    </form>
  );
};
