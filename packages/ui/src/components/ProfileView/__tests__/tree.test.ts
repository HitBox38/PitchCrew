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
      'role.md',
      'Projects',
      'Atlas',
      'context.md',
      'Skills',
      'Design',
      'background.md',
    ]);
    expect(rows.find(({ node }) => node.label === 'context.md')).toMatchObject({
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
      'context.md',
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
      { node: { label: 'context.md' } },
    ]);
    expect(visibleProfileTree(tree.root, collapsed, 'no-match')).toEqual([]);
    expect(collapsed.size).toBe(3);
  });
});
