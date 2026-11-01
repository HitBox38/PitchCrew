import { Lock } from 'lucide-react';
import { Button } from '@pitchcrew/design-system/button';
import { Kbd } from '@pitchcrew/design-system/kbd';
import { modKey } from '@/shortcuts.ts';
import { wordCount } from '../helpers.ts';

export const ProfileSaveBar = ({
  location,
  renamed,
  content,
  status,
  error,
  blocker,
  working,
}: {
  location: string;
  renamed: string;
  content: string;
  status: string;
  error: string;
  blocker: string;
  working: boolean;
}) => {
  const words = wordCount(content);
  return (
    <footer className="profile-save-bar">
      <span className="profile-save-path" title={location}>
        {location}
        {renamed ? ` → ${renamed}` : ''} · {words} {words === 1 ? 'word' : 'words'}
      </span>
      {error ? (
        <p className="profile-save-error" role="alert">
          {error}
        </p>
      ) : blocker ? (
        <output className="profile-save-blocked" aria-live="polite">
          <Lock size={14} aria-hidden="true" /> {blocker}
        </output>
      ) : (
        <output className="profile-save-state" aria-live="polite">
          {status}
        </output>
      )}
      <Button type="submit" size="sm" disabled={working || !!blocker} aria-label="Save note">
        {working ? 'Saving…' : 'Save'}
        <Kbd className="profile-save-kbd" aria-hidden="true">
          {modKey.trim()}S
        </Kbd>
      </Button>
    </footer>
  );
};
