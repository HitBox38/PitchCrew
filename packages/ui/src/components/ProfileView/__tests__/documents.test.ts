import { describe, expect, it } from 'vitest';
import {
  closeDocument,
  discardDocuments,
  documentDirty,
  openDocument,
  syncDocuments,
  reorderDocument,
} from '../helpers.ts';

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
    const next = openDocument(state, imported, 'duplicate', true);
    expect(next.activeId).toBe('background');
    expect(next.documents).toHaveLength(2);
    expect(next.documents[0].saved).toEqual(imported);
    expect(documentDirty(next.documents[0])).toBe(false);
  });
});
