import { Check, CircleAlert, LoaderCircle, Lock, PencilLine } from 'lucide-react';
import type { ProfileSectionProps } from '../types.ts';
import { profileNoteLimit } from '../layout.ts';

/** One truthful line about the open note's saved state, announced politely when it changes. */
export const ProfileSaveState = ({ controller: c, workspace: w }: ProfileSectionProps) => {
  const document = c.active;
  const state = (() => {
    if (w.limitHit)
      return {
        tone: 'error',
        icon: CircleAlert,
        text: `A note holds up to ${profileNoteLimit.toLocaleString()} characters`,
      };
    if (document?.conflict) return { tone: 'warn', icon: CircleAlert, text: 'Not saved' };
    if (c.error) return { tone: 'error', icon: CircleAlert, text: c.error };
    if (c.dirty && c.blocker) return { tone: 'warn', icon: Lock, text: c.blocker };
    if (document?.saving !== null) return { tone: 'busy', icon: LoaderCircle, text: 'Saving…' };
    // Autosave is about to run: quiet, not a warning.
    if (c.dirty && c.autosave && document?.persisted)
      return { tone: 'idle', icon: PencilLine, text: 'Edited' };
    if (c.dirty)
      return {
        tone: 'warn',
        icon: null,
        text: document?.persisted ? 'Unsaved changes' : 'Not saved yet',
      };
    // With autosave off, say so before the first edit, not only after it.
    return { tone: 'done', icon: Check, text: c.autosave ? 'Saved' : 'Saved · autosave off' };
  })();
  const Icon = state.icon;
  return (
    <output
      className="profile-save-state"
      data-tone={state.tone}
      aria-live="polite"
      title={state.text}
    >
      {Icon ? (
        <Icon size={13} aria-hidden="true" />
      ) : (
        <span className="profile-save-dot" aria-hidden="true" />
      )}
      <span className="profile-save-text">{state.text}</span>
    </output>
  );
};
