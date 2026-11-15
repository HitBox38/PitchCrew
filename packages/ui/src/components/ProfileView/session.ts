import type { ProfileDocumentsState } from './types.ts';
import { openDocument } from './documents.ts';

/** Which notes were open on this device, so Profile reopens where the user left off. */
export interface ProfileSession {
  open: string[];
  active: string | null;
}
const key = 'pitchcrew.profile.session';

export const readSession = (): ProfileSession | null => {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(key) ?? 'null');
    if (!value || typeof value !== 'object') return null;
    const { open, active } = value as Record<string, unknown>;
    return {
      open: Array.isArray(open)
        ? open.filter((name): name is string => typeof name === 'string').slice(0, 30)
        : [],
      active: typeof active === 'string' ? active : null,
    };
  } catch {
    return null;
  }
};

export const writeSession = (session: ProfileSession) => {
  try {
    localStorage.setItem(key, JSON.stringify(session));
  } catch {
    /* A per-device convenience; the open tabs still work for this visit. */
  }
};

/**
 * The tabs to open: the saved session's notes that still exist, else profile.md or the first
 * note. A profile with no notes opens nothing, so no placeholder is ever saved as evidence.
 */
export const restoreSession = (
  notes: { name: string; content: string }[],
  session: ProfileSession | null,
  id: () => string,
): ProfileDocumentsState => {
  const byName = new Map(notes.map((note) => [note.name, note]));
  const sorted = [...notes].sort((a, b) =>
    a.name.localeCompare(b.name, undefined, { numeric: true }),
  );
  const remembered = (session?.open ?? []).filter((name) => byName.has(name));
  const names = remembered.length
    ? remembered
    : [byName.has('profile.md') ? 'profile.md' : sorted[0]?.name].filter(
        (name): name is string => !!name,
      );
  let state: ProfileDocumentsState = { documents: [], activeId: null };
  for (const name of names) state = openDocument(state, byName.get(name)!, id());
  const active = state.documents.find((document) => document.saved.name === session?.active);
  return active ? { ...state, activeId: active.id } : state;
};
