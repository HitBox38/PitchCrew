import type { ProfileViewModel } from '../types.ts';
import { useState } from 'react';
import { buildProfileTree, noteFolder, visibleProfileTree } from '../tree.ts';

export const useProfileNotes = ({
  data,
  sourceController,
  documents,
}: Pick<ProfileViewModel, 'data' | 'sourceController' | 'documents'>) => {
  const [query, setQuery] = useState('');
  const [collapsed, setCollapsed] = useState(new Set<string>());
  const [selectedFolder, setSelectedFolder] = useState('');
  const paths = new Map(
    sourceController.sources.flatMap((source) =>
      source.files.map((file) => [file.name, file.path] as const),
    ),
  );
  // Search sees open drafts, not only what is saved.
  const drafts = new Map(documents.map((document) => [document.saved.name, document.content]));
  const notes = [
    ...data.profile.map((note) =>
      drafts.has(note.name) ? { ...note, content: drafts.get(note.name)! } : note,
    ),
    ...documents
      .filter((document) => !data.profile.some((note) => note.name === document.saved.name))
      .map((document) => ({ name: document.saved.name, content: document.content })),
  ];
  const tree = buildProfileTree(notes, paths, data.profileOrganization);
  const rows = sourceController.loaded
    ? visibleProfileTree(tree.root, collapsed, query, false)
    : [];
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
  const location = (name: string) => {
    if (!sourceController.loaded)
      return sourceController.loading
        ? 'Loading note information…'
        : 'Note information unavailable';
    return [
      ...noteFolder(name, data.profileOrganization, paths).split('/'),
      paths.get(name)?.split('/').at(-1) || name,
    ]
      .filter(Boolean)
      .join(' / ');
  };
  return {
    folderOf: (name: string) => noteFolder(name, data.profileOrganization, paths),
    query,
    setQuery,
    paths,
    rows,
    folders: tree.folders,
    collapsed,
    toggle,
    reveal,
    location,
    selectedFolder,
    setSelectedFolder,
  };
};
