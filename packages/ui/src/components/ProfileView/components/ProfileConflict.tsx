import { useState } from 'react';
import { TriangleAlert } from 'lucide-react';
import { Button } from '@pitchcrew/design-system/button';
import type { ProfileSectionProps } from '../types.ts';
import { ProfileCompareDialog } from './ProfileCompareDialog.tsx';

/**
 * The saved note changed (or was removed) outside this editor while a draft was open. Nothing is
 * written until the user picks a side: the saved copy, or their draft over it; Compare shows
 * the difference first. It waits on the user, so it is ochre.
 */
export const ProfileConflict = ({ controller: c, workspace }: ProfileSectionProps) => {
  const [comparing, setComparing] = useState(false);
  const document = c.active;
  if (!document?.conflict) return null;
  const { id, conflict } = document;
  const removed = conflict.current === null;
  const keep = (side: 'disk' | 'mine') => {
    setComparing(false);
    c.resolveConflict(id, side);
    workspace.editor.current?.focus();
  };
  return (
    <div className="profile-conflict" role="alert">
      <TriangleAlert size={16} aria-hidden="true" className="profile-conflict-icon" />
      <p className="profile-conflict-text">
        <b>{removed ? 'This note was removed from disk.' : 'This note changed on disk.'}</b>{' '}
        {removed
          ? 'Your draft is still here: keep it to save the note again, or close it.'
          : 'Your draft is not saved. Compare them, then keep one.'}
      </p>
      <div className="profile-conflict-actions">
        {removed ? null : (
          <Button size="sm" onClick={() => setComparing(true)}>
            Compare
          </Button>
        )}
        <Button variant="outline" size="sm" onClick={() => keep('disk')}>
          {removed ? 'Close note' : 'Use saved copy'}
        </Button>
        <Button variant="outline" size="sm" onClick={() => keep('mine')}>
          Keep my draft
        </Button>
      </div>
      {comparing && conflict.current !== null ? (
        <ProfileCompareDialog
          name={document.name}
          disk={conflict.current}
          draft={document.content}
          close={() => setComparing(false)}
          keep={keep}
        />
      ) : null}
    </div>
  );
};
