import { describe, expect, it } from 'vitest';
import {
  closeDocument,
  discardDocuments,
  documentDirty,
  openDocument,
  resolveConflict,
  syncDocuments,
  reorderDocument,
} from '../documents.ts';
import { restoreSession } from '../session.ts';

const background = { name: 'background.md', content: '# Background' };
const projects = { name: 'projects.md', content: '# Projects' };
const opened = () =>
  openDocument(
    openDocument({ documents: [], activeId: null }, background, 'background'),
    projects,
    'projects',
  );

describe('open profile documents', () => {
  it('reorders open tabs while retaining active identity, draft contents and saved snapshots', () => {
    const state = opened();
    state.documents[0] = { ...state.documents[0], content: '# Unsaved draft' };
    const reordered = reorderDocument(state, 'background', 1);
    expect(reordered.documents.map((document) => document.id)).toEqual(['projects', 'background']);
    expect(reordered.activeId).toBe('projects');
    expect(reordered.documents[1]).toBe(state.documents[0]);
    expect(documentDirty(reordered.documents[1])).toBe(true);
    expect(reorderDocument(reordered, 'background', 0).documents).toEqual(state.documents);
  });

  it('ignores outdated or invalid reorder requests without closing or changing any tab', () => {
    const state = opened();
    for (const [id, index] of [
      ['missing', 0],
      ['background', -1],
      ['background', 2],
      ['background', 0.5],
      ['background', 0],
    ] as const)
      expect(reorderDocument(state, id, index)).toBe(state);
  });

  it('reopens an existing tab without replacing its unsaved content or filename', () => {
    const state = opened();
    state.documents[0] = { ...state.documents[0], name: 'renamed.md', content: '# Unsaved draft' };
    const reopened = openDocument(state, background, 'duplicate');
    expect(reopened.activeId).toBe('background');
    expect(reopened.documents).toHaveLength(2);
    expect(reopened.documents[0]).toMatchObject({ name: 'renamed.md', content: '# Unsaved draft' });
    expect(documentDirty(reopened.documents[0])).toBe(true);
  });

  it('closing one tab preserves another draft and selects the neighboring document', () => {
    const state = opened();
    state.documents[0] = { ...state.documents[0], content: '# Keep this draft' };
    const closed = closeDocument(state, 'projects');
    expect(closed.activeId).toBe('background');
    expect(closed.documents[0].content).toBe('# Keep this draft');
    expect(documentDirty(closed.documents[0])).toBe(true);
    expect(closeDocument(closed, 'background')).toEqual({ activeId: null, documents: [] });
  });

  it('refreshes saved source copies while retaining local drafts in other tabs', () => {
    const state = opened();
    state.documents[0] = { ...state.documents[0], content: '# Local draft' };
    const refreshed = syncDocuments(state, [
      { ...background, content: '# Updated background' },
      { ...projects, content: '# Updated projects' },
    ]);
    expect(refreshed.documents[0].content).toBe('# Local draft');
    expect(refreshed.documents[0].conflict).toEqual({ current: '# Updated background' });
    expect(refreshed.documents[1].content).toBe('# Updated projects');
    expect(documentDirty(refreshed.documents[1])).toBe(false);
  });

  it('discards all open drafts after confirmed navigation, including renamed notes', () => {
    const state = opened();
    state.documents = state.documents.map((document) => ({
      ...document,
      name: 'changed.md',
      content: '# Draft',
    }));
    const discarded = discardDocuments(state);
    expect(discarded.documents.map(({ name, content }) => ({ name, content }))).toEqual([
      background,
      projects,
    ]);
    expect(discarded.documents.some(documentDirty)).toBe(false);
  });

  it('opens an approved imported snapshot in its existing tab', () => {
    const state = opened();
    const imported = { ...background, content: '# Reviewed import' };
    const next = openDocument(state, imported, 'duplicate', { replace: true });
    expect(next.activeId).toBe('background');
    expect(next.documents).toHaveLength(2);
    expect(next.documents[0].saved).toEqual(imported);
    expect(documentDirty(next.documents[0])).toBe(false);
  });

  it('closes clean tabs whose note was removed and keeps a removed draft as a conflict', () => {
    const state = opened();
    state.documents[0] = { ...state.documents[0], content: '# Keep me' };
    const synced = syncDocuments(state, []);
    expect(synced.documents.map((document) => document.id)).toEqual(['background']);
    expect(synced.documents[0].conflict).toEqual({ current: null });
    expect(synced.activeId).toBe('background');
  });

  it('never mistakes its own save in flight for an outside change', () => {
    const state = opened();
    state.documents[1] = { ...state.documents[1], content: '# Typed', saving: '# Typed' };
    expect(syncDocuments(state, [background, { ...projects, content: '# Typed' }])).toBe(state);
  });

  it('adopts a disk copy that already matches the draft without a conflict', () => {
    const state = opened();
    state.documents[0] = { ...state.documents[0], content: '# Same' };
    const synced = syncDocuments(state, [{ ...background, content: '# Same' }, projects]);
    expect(synced.documents[0]).toMatchObject({ conflict: null, saved: { content: '# Same' } });
    expect(documentDirty(synced.documents[0])).toBe(false);
  });

  it('resolves a conflict toward the saved copy or keeps the draft over it', () => {
    const state = opened();
    const draft = { ...state.documents[0], content: '# Mine', conflict: { current: '# Theirs' } };
    expect(resolveConflict(draft, 'disk')).toMatchObject({ content: '# Theirs', conflict: null });
    const kept = resolveConflict(draft, 'mine')!;
    expect(kept).toMatchObject({
      content: '# Mine',
      saved: { content: '# Theirs' },
      conflict: null,
    });
    expect(documentDirty(kept)).toBe(true);
    expect(resolveConflict({ ...draft, conflict: { current: null } }, 'disk')).toBeNull();
    expect(resolveConflict({ ...draft, conflict: { current: null } }, 'mine')).toMatchObject({
      persisted: false,
    });
  });

  it('treats a never-saved note as unsaved and drops it on discard', () => {
    const state = openDocument(opened(), { name: 'new.md', content: '# New' }, 'new', {
      persisted: false,
    });
    expect(documentDirty(state.documents[2])).toBe(true);
    const discarded = discardDocuments(state);
    expect(discarded.documents.map((document) => document.id)).toEqual(['background', 'projects']);
    expect(discarded.activeId).toBe('background');
  });

  it('restores the remembered tabs, else profile.md, and opens nothing for an empty profile', () => {
    const notes = [projects, background, { name: 'profile.md', content: '# Me' }];
    let id = 0;
    const next = () => `tab-${++id}`;
    const restored = restoreSession(
      notes,
      { open: ['projects.md', 'gone.md', 'background.md'], active: 'projects.md' },
      next,
    );
    expect(restored.documents.map((document) => document.name)).toEqual([
      'projects.md',
      'background.md',
    ]);
    expect(restored.documents.find((document) => document.id === restored.activeId)?.name).toBe(
      'projects.md',
    );
    expect(restoreSession(notes, null, next).documents.map((document) => document.name)).toEqual([
      'profile.md',
    ]);
    expect(restoreSession([], null, next)).toEqual({ documents: [], activeId: null });
  });
});
