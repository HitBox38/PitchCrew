import type { ProfileFile, ProfileOrganization } from '@pitchcrew/core';
import type { ProfileTreeNode } from './types.ts';
import { noteLabel } from './helpers.ts';

export const noteFolder = (
  name: string,
  organization: ProfileOrganization | undefined,
  paths: Map<string, string>,
) => {
  if (organization && Object.hasOwn(organization.locations, name))
    return organization.locations[name];
  return paths.get(name)?.split('/').slice(0, -1).filter(Boolean).join('/') ?? '';
};

export const buildProfileTree = (
  notes: ProfileFile[],
  paths: Map<string, string>,
  organization?: ProfileOrganization,
) => {
  const root: ProfileTreeNode = {
    key: 'folder:',
    label: 'profile',
    path: '',
    folder: true,
    children: [],
  };
  const folders = new Map([['', root]]);
  const ensureFolder = (path: string): ProfileTreeNode => {
    if (folders.has(path)) return folders.get(path)!;
    const parts = path.split('/');
    const parent = ensureFolder(parts.slice(0, -1).join('/'));
    const node: ProfileTreeNode = {
      key: `folder:${path}`,
      label: parts.at(-1)!,
      path,
      folder: true,
      children: [],
    };
    folders.set(path, node);
    parent.children.push(node);
    return node;
  };
  for (const path of organization?.folders ?? []) ensureFolder(path).explicit = true;
  for (const note of notes) {
    const path = noteFolder(note.name, organization, paths);
    ensureFolder(path).children.push({
      key: `note:${note.name}`,
      // Like Obsidian, the explorer names notes as words, without the .md every note shares.
      label: noteLabel(paths.get(note.name)?.split('/').at(-1) || note.name),
      path,
      folder: false,
      note,
      children: [],
    });
  }
  for (const folder of folders.values())
    folder.children.sort(
      (a, b) =>
        Number(b.folder) - Number(a.folder) ||
        a.label.localeCompare(b.label, undefined, { numeric: true }),
    );
  return { root, folders: [...folders.keys()].sort((a, b) => a.localeCompare(b)) };
};

export const visibleProfileTree = (
  root: ProfileTreeNode,
  collapsed: Set<string>,
  query: string,
  includeRoot = true,
) => {
  const rows: {
    node: ProfileTreeNode;
    depth: number;
    parent: string | null;
    position: number;
    size: number;
    /** For a note found by its text rather than its name: the matching passage and term. */
    snippet?: { text: string; count: number; term: string };
  }[] = [];
  const search = query.trim().toLocaleLowerCase().replace(/\s+/g, ' ');
  const named = (node: ProfileTreeNode) =>
    `${node.label} ${node.path} ${node.note?.name ?? ''}`.toLocaleLowerCase().includes(search);
  const texts = new Map<ProfileTreeNode, string>();
  const text = (node: ProfileTreeNode) => {
    if (!node.note || !search) return '';
    if (!texts.has(node)) texts.set(node, textTerm(node.note.content, search));
    return texts.get(node)!;
  };
  const matches = (node: ProfileTreeNode): boolean =>
    named(node) || !!text(node) || node.children.some(matches);
  const visit = (
    node: ProfileTreeNode,
    depth: number,
    parent: string | null,
    position: number,
    size: number,
  ) => {
    if (search && !matches(node)) return;
    const term = search && !named(node) ? text(node) : '';
    const found = term && node.note ? passage(node.note.content, term) : undefined;
    const snippet = found && { ...found, term };
    rows.push({ node, depth, parent, position, size, snippet });
    if (!node.folder || (!search && collapsed.has(node.path))) return;
    const children = search ? node.children.filter(matches) : node.children;
    children.forEach((child, index) =>
      visit(child, depth + 1, node.key, index + 1, children.length),
    );
  };
  if (includeRoot) visit(root, 1, null, 1, 1);
  else {
    // The profile folder itself is implicit: its contents are the top level of the tree.
    const children = search ? root.children.filter(matches) : root.children;
    children.forEach((child, index) => visit(child, 1, null, index + 1, children.length));
  }
  return rows;
};

/**
 * What of a search a note's text contains: the whole phrase, or, when every word appears but
 * not side by side, the longest word (to show and reveal). Empty for no match.
 */
const textTerm = (content: string, search: string) => {
  const body = content.toLocaleLowerCase();
  if (body.includes(search)) return search;
  const words = search.split(' ');
  if (words.length < 2 || !words.every((word) => body.includes(word))) return '';
  return words.reduce((longest, word) => (word.length > longest.length ? word : longest));
};

/** One source line as readable text: block marks gone, table cells joined with " · ". */
const plainLine = (line: string) => {
  let text = line
    .replace(/\]\([^)]*\)/g, ']')
    .replace(/^\s*(?:#{1,6}|>|[-*+]|\d+[.)])\s+/, '')
    .replace(/^\s*\[[ xX]\]\s+/, '');
  if (/^\s*\|.*\|\s*$/.test(text))
    text = text
      .trim()
      .replace(/^\||\|$/g, '')
      .split('|')
      .map((cell) => cell.trim())
      .join(' · ');
  return text
    .replace(/[*_`~[\]]+/g, '')
    .replace(/\s+/g, ' ')
    .trim();
};

/**
 * The first line that mentions the search, as readable text starting on a word about 24
 * characters before the match, and how many times the note matches in all.
 */
export const passage = (content: string, search: string) => {
  const lines = content.split(/\r?\n/).filter((line) => !/^[\s|:-]*-{3,}[\s|:-]*$/.test(line));
  let count = 0;
  let first: string | undefined;
  for (const line of lines) {
    const text = plainLine(line);
    const lower = text.toLocaleLowerCase();
    for (let at = lower.indexOf(search); at >= 0; at = lower.indexOf(search, at + search.length)) {
      count++;
      first ??= text;
    }
  }
  if (!first) return undefined;
  const at = first.toLocaleLowerCase().indexOf(search);
  let start = Math.max(0, at - 24);
  if (start > 0) start = first.indexOf(' ', start) + 1 || start;
  if (start > at) start = at;
  const end = at + search.length + 48;
  return {
    text: `${start > 0 ? '…' : ''}${first.slice(start, end).trim()}${end < first.length ? '…' : ''}`,
    count,
  };
};
