import type { ProfileNotesProps } from '../types.ts';
import { useState } from 'react';
import { buildProfileTree, visibleProfileTree } from '../tree.ts';

export function useProfileNotes({ data, sourceController, documents }: ProfileNotesProps) {
  const [query, setQuery] = useState('');
  const [collapsed, setCollapsed] = useState(new Set<string>());
  const [selectedFolder, setSelectedFolder] = useState('');
  const paths = new Map(
    sourceController.sources.flatMap((source) =>
      source.files.map((file) => [file.name, file.path] as const),
    ),
  );
  const notes = [
    ...data.profile,
    ...documents
      .filter((document) => !data.profile.some((note) => note.name === document.saved.name))
      .map((document) => ({ name: document.saved.name, content: document.content })),
  ];
  const tree = buildProfileTree(notes, paths, data.profileOrganization);
  const rows = visibleProfileTree(tree.root, collapsed, query);
  const toggle = (path: string) =>
    setCollapsed((current) => {
      const next = new Set(current);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  const reveal = (path: string) => {
    setCollapsed(
      (current) =>
        new Set(
          [...current].filter(
            (folder) => folder !== '' && folder !== path && !path.startsWith(folder + '/'),
          ),
        ),
    );
    setSelectedFolder(path);
    setQuery('');
  };
  return {
    query,
    setQuery,
    paths,
    rows,
    folders: tree.folders,
    collapsed,
    toggle,
    reveal,
    selectedFolder,
    setSelectedFolder,
  };
}
