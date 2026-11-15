import { MarkdownEditor } from '@/components/MarkdownEditor/index.tsx';
import { MarkdownToolbar } from '@/components/MarkdownEditor/components/MarkdownToolbar.tsx';
import type { ProfileSectionProps } from '../types.ts';
import { profileNoteLimit } from '../layout.ts';
import { ProfileConflict } from './ProfileConflict.tsx';
import { ProfileStatusBar } from './ProfileStatusBar.tsx';

/** The open note: formatting tools, any disk conflict, the editor, then the status bar. */
export const ProfileEditor = (props: ProfileSectionProps) => {
  const { controller: c, workspace: w } = props;
  return (
    <>
      <MarkdownToolbar
        handle={w.editor}
        preview={w.mode === 'preview'}
        active={w.cursor?.formats}
        onFind={w.find}
      />
      <ProfileConflict {...props} />
      <div className="profile-sheet">
        <MarkdownEditor
          id="profile-content"
          label="Profile Markdown"
          documentKey={c.active ? `${c.active.id}#${c.active.revision}` : ''}
          content={c.content}
          onChange={c.setContent}
          maxLength={profileNoteLimit}
          mode={w.mode}
          handle={w.editor}
          onCursor={w.setCursor}
          onView={w.setViewLine}
          onLimit={w.flagLimit}
          showSyntax={w.showSyntax}
          describedBy="profile-editor-hint"
          placeholder="Write what your crew may say about you. Type / for headings, lists and tables."
        />
      </div>
      <p id="profile-editor-hint" className="sr-only">
        Markdown. Type / at the start of a line for blocks. Escape then Tab leaves the editor.
      </p>
      <ProfileStatusBar {...props} />
    </>
  );
};
