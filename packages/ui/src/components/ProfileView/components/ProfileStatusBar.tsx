import { Lock } from 'lucide-react';
import { Button } from '@pitchcrew/design-system/button';
import { Kbd } from '@pitchcrew/design-system/kbd';
import { modKey } from '@/shortcuts.ts';
import { wordCount } from '../helpers.ts';
import type { ProfileSectionProps } from '../types.ts';
import { ProfileOrigin } from './ProfileOrigin.tsx';
import { ProfileCitedControl } from './ProfileCitedControl.tsx';

/**
 * The sheet's footer: where the note lives, how long it is, which packets cite it, whether it is
 * saved (or the truthful reason saving waits), and Save.
 */
export const ProfileStatusBar = (props: ProfileSectionProps) => {
  const { controller: c, tree } = props;
  const location = tree.location(c.activeSavedName);
  const renamed = c.name !== c.activeSavedName ? c.name : '';
  const words = wordCount(c.content);
  const status = c.dirty
    ? 'Unsaved changes'
    : c.data.profile.some((file) => file.name === c.name)
      ? 'Saved'
      : 'New note';
  return (
    <footer className="profile-save-bar">
      <span className="profile-save-path" title={location}>
        {location}
        {renamed ? ` → ${renamed}` : ''}
      </span>
      <ProfileOrigin {...c} />
      <span className="profile-status-words">
        {words} {words === 1 ? 'word' : 'words'}
      </span>
      <ProfileCitedControl {...props} />
      {c.error ? (
        <p className="profile-save-error" role="alert">
          {c.error}
        </p>
      ) : c.blocker ? (
        <output className="profile-save-blocked" aria-live="polite">
          <Lock size={13} aria-hidden="true" /> {c.blocker}
        </output>
      ) : (
        <output className="profile-save-state" data-dirty={c.dirty || undefined} aria-live="polite">
          {status}
        </output>
      )}
      <Button type="submit" size="sm" disabled={c.working || !!c.blocker} aria-label="Save note">
        {c.working ? 'Saving…' : 'Save'}
        <Kbd className="profile-save-kbd" aria-hidden="true">
          {modKey.trim()}S
        </Kbd>
      </Button>
    </footer>
  );
};
