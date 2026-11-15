import { Button } from '@pitchcrew/design-system/button';
import { Kbd } from '@pitchcrew/design-system/kbd';
import { editorKeys, shortcutLabel } from '@/components/MarkdownEditor/shortcuts.ts';
import { wordCount } from '../helpers.ts';
import { markdownOutline } from '@/components/MarkdownEditor/helpers.ts';
import { profileNoteLimit } from '../layout.ts';
import type { ProfileSectionProps } from '../types.ts';
import { ProfileOrigin } from './ProfileOrigin.tsx';
import { ProfileCitedControl } from './ProfileCitedControl.tsx';
import { ProfileSaveState } from './ProfileSaveState.tsx';
import { ProfileStatusMenu } from './ProfileStatusMenu.tsx';

/**
 * The sheet's footer: where the note lives, where the caret is, how long it is, which packets
 * cite it, and whether it is saved (or the truthful reason saving waits).
 */
export const ProfileStatusBar = (props: ProfileSectionProps) => {
  const { controller: c, tree, workspace: w } = props;
  const words = wordCount(c.content);
  const near = c.content.length > profileNoteLimit * 0.9;
  const manual = c.dirty && (!c.autosave || !!c.error) && !c.active?.conflict;
  // The section in view while scrolling (Write or Preview), otherwise the caret's.
  const line = w.viewLine ?? w.cursor?.line ?? 0;
  const section = markdownOutline(c.content).findLast((entry) => entry.line <= line);
  return (
    <footer className="profile-save-bar">
      <span className="profile-status-where">
        <span className="profile-save-path" title={tree.location(c.activeSavedName)}>
          {tree.location(c.activeSavedName)}
        </span>
        {section ? (
          <span className="profile-status-section" title={section.text}>
            {section.text}
          </span>
        ) : null}
        <ProfileOrigin {...c} />
      </span>
      {w.cursor && w.mode !== 'preview' ? (
        <span className="profile-status-caret">
          Ln {w.cursor.line}, Col {w.cursor.column}
          {w.cursor.selected ? ` (${w.cursor.selected.toLocaleString()} selected)` : ''}
        </span>
      ) : null}
      <span className="profile-status-words" data-near={near || undefined}>
        {near
          ? `${c.content.length.toLocaleString()} / ${profileNoteLimit.toLocaleString()} characters`
          : `${words.toLocaleString()} ${words === 1 ? 'word' : 'words'}`}
      </span>
      <ProfileCitedControl {...props} />
      <ProfileSaveState {...props} />
      {manual ? (
        <Button
          type="submit"
          size="sm"
          variant="outline"
          disabled={!!c.blocker || c.active?.saving !== null}
          aria-label="Save note"
        >
          {c.error ? 'Retry' : 'Save'}
          <Kbd className="profile-save-kbd" aria-hidden="true">
            {shortcutLabel(editorKeys.save)}
          </Kbd>
        </Button>
      ) : null}
      <ProfileStatusMenu {...props} />
    </footer>
  );
};
