import { describe, expect, it } from 'vitest';
import { buildProfileTree, visibleProfileTree, noteFolder } from '../tree.ts';

const notes = [
  { name: 'background.md', content: '# Background' },
  { name: 'atlas-stable-id.md', content: '# Atlas' },
  { name: 'other-stable-id.md', content: '# Other' },
];
const paths = new Map([
  ['atlas-stable-id.md', 'Projects/Atlas/context.md'],
  ['other-stable-id.md', 'Experience/role.md'],
]);

describe('profile folder tree', () => {
  it('preserves empty folders and renders nested imported paths with stable note identities', () => {
    const tree = buildProfileTree(notes, paths, {
      version: 1,
      folders: ['Skills/Design'],
      locations: {},
    });
    const rows = visibleProfileTree(tree.root, new Set(), '');
    expect(rows.map(({ node }) => node.label)).toEqual([
      'profile',
      'Experience',
      'role',
      'Projects',
      'Atlas',
      'context',
      'Skills',
      'Design',
      'background',
    ]);
    expect(rows.find(({ node }) => node.label === 'context')).toMatchObject({
      depth: 4,
      node: { note: { name: 'atlas-stable-id.md' } },
    });
  });

  it('moves an imported note to root or another folder without changing its source label', () => {
    const organization = {
      version: 1 as const,
      folders: ['Selected'],
      locations: { 'atlas-stable-id.md': '', 'other-stable-id.md': 'Selected' },
    };
    const tree = buildProfileTree(notes, paths, organization);
    expect(noteFolder('atlas-stable-id.md', organization, paths)).toBe('');
    expect(tree.root.children.find(({ note }) => note?.name === 'atlas-stable-id.md')?.label).toBe(
      'context',
    );
    expect(tree.folders).toEqual(['', 'Selected']);
  });

  it('search reveals matching ancestors through collapsed folders without changing their state', () => {
    const tree = buildProfileTree(notes, paths);
    const collapsed = new Set(['', 'Projects', 'Projects/Atlas']);
    expect(visibleProfileTree(tree.root, collapsed, '')).toHaveLength(1);
    expect(visibleProfileTree(tree.root, collapsed, 'atlas-stable-id')).toMatchObject([
      { node: { label: 'profile' } },
      { node: { label: 'Projects' } },
      { node: { label: 'Atlas' } },
      { node: { label: 'context' } },
    ]);
    expect(visibleProfileTree(tree.root, collapsed, 'no-match')).toEqual([]);
    expect(collapsed.size).toBe(3);
  });

  it('treats the profile folder as the implicit top level when the root row is omitted', () => {
    const tree = buildProfileTree(notes, paths);
    const rows = visibleProfileTree(tree.root, new Set(['Projects']), '', false);
    expect(rows.map(({ node }) => node.label)).toEqual([
      'Experience',
      'role',
      'Projects',
      'background',
    ]);
    expect(rows[0]).toMatchObject({ depth: 1, parent: null, position: 1, size: 3 });
    expect(rows[1]).toMatchObject({ depth: 2, parent: 'folder:Experience' });
    expect(
      visibleProfileTree(tree.root, new Set(), 'context', false).map(({ node }) => node.label),
    ).toEqual(['Projects', 'Atlas', 'context']);
  });

  it('finds notes by their text and shows the matching passage under the note', () => {
    const tree = buildProfileTree(notes, new Map());
    const rows = visibleProfileTree(tree.root, new Set(), 'atlas', false);
    expect(rows.map(({ node, snippet }) => [node.label, snippet])).toEqual([
      ['atlas stable id', undefined],
    ]);
    const text = visibleProfileTree(tree.root, new Set(), 'other', false);
    expect(text[0]).toMatchObject({ node: { label: 'other stable id' }, snippet: undefined });
    const byContent = visibleProfileTree(
      buildProfileTree(
        [{ name: 'role.md', content: 'Led the CRDT sync engine rewrite.' }],
        new Map(),
      ).root,
      new Set(),
      'crdt',
      false,
    );
    expect(byContent[0].snippet).toEqual({
      text: 'Led the CRDT sync engine rewrite.',
      count: 1,
      term: 'crdt',
    });
    const table = visibleProfileTree(
      buildProfileTree(
        [{ name: 'years.md', content: '| Year | Team |\n| --- | --- |\n| 2024 | Atlas team |' }],
        new Map(),
      ).root,
      new Set(),
      'team',
      false,
    );
    expect(table[0].snippet).toEqual({ text: 'Year · Team', count: 2, term: 'team' });
    // Words that are not side by side still find the note; the longest one is shown.
    const words = visibleProfileTree(
      buildProfileTree([{ name: 'skills.md', content: '- TypeScript\n- React\n- Rust' }], new Map())
        .root,
      new Set(),
      'typescript   react',
      false,
    );
    expect(words[0].snippet).toEqual({ text: 'TypeScript', count: 1, term: 'typescript' });
  });
});
