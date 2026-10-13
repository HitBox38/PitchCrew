import type { ProfileFile, ProfileOrganization } from '@pitchcrew/core';
import type { ProfileTreeNode } from './types.ts';

export function noteFolder(
  name: string,
  organization: ProfileOrganization | undefined,
  paths: Map<string, string>,
) {
  if (organization && Object.hasOwn(organization.locations, name))
    return organization.locations[name];
  return paths.get(name)?.split('/').slice(0, -1).filter(Boolean).join('/') ?? '';
}

export function buildProfileTree(
  notes: ProfileFile[],
  paths: Map<string, string>,
  organization?: ProfileOrganization,
) {
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
  for (const path of organization?.folders ?? []) ensureFolder(path);
  for (const note of notes) {
    const path = noteFolder(note.name, organization, paths);
    ensureFolder(path).children.push({
      key: `note:${note.name}`,
      label: paths.get(note.name)?.split('/').at(-1) || note.name,
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
}

export function visibleProfileTree(root: ProfileTreeNode, collapsed: Set<string>, query: string) {
  const rows: {
    node: ProfileTreeNode;
    depth: number;
    parent: string | null;
    position: number;
    size: number;
  }[] = [];
  const search = query.trim().toLocaleLowerCase();
  const matches = (node: ProfileTreeNode): boolean =>
    `${node.label} ${node.path} ${node.note?.name ?? ''}`.toLocaleLowerCase().includes(search) ||
    node.children.some(matches);
  const visit = (
    node: ProfileTreeNode,
    depth: number,
    parent: string | null,
    position: number,
    size: number,
  ) => {
    if (search && !matches(node)) return;
    rows.push({ node, depth, parent, position, size });
    if (!node.folder || (!search && collapsed.has(node.path))) return;
    const children = search ? node.children.filter(matches) : node.children;
    children.forEach((child, index) =>
      visit(child, depth + 1, node.key, index + 1, children.length),
    );
  };
  visit(root, 1, null, 1, 1);
  return rows;
}
