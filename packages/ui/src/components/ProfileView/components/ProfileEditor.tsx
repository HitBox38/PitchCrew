import type { ProfileSectionProps } from '../types.ts';
import { ProfileStatusBar } from './ProfileStatusBar.tsx';
import { MarkdownEditor } from '@/components/MarkdownEditor/index.tsx';
import { useMarkdownSaveShortcut } from '@/components/MarkdownEditor/hooks/useMarkdownSaveShortcut.ts';

/** The open note: the Write and Preview panels, then the status bar with Save. */
export const ProfileEditor = (props: ProfileSectionProps) => {
  const { controller: c } = props;
  const form = useMarkdownSaveShortcut();
  return (
    <form
      className="profile-note-form"
      ref={form}
      aria-label={c.name || 'Untitled note'}
      onSubmit={(event) => void c.save(event)}
    >
      <div className="profile-sheet">
        <MarkdownEditor
          id="profile-content"
          label="Profile Markdown"
          content={c.content}
          onChange={c.setContent}
          maxLength={50000}
        />
      </div>
      <ProfileStatusBar {...props} />
    </form>
  );
};
