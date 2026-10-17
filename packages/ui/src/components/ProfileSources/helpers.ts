import type { ProfileImportFile, ProfileSource, ProfileSourceInput } from '@pitchcrew/core';
import type { ProfileSourcesModel } from './types.ts';

export function sourceLocation(source: ProfileSource) {
  const input = source.input;
  if (input.provider === 'drive') return `Google Drive folder ${input.folderId}`;
  return `${input.repository}${input.path ? ` / ${input.path}` : ' / Entire repository'}${input.ref ? ` (${input.ref})` : ''}`;
}

export function sourceHeading(c: ProfileSourcesModel) {
  if (c.proposalId)
    return {
      title: 'Review profile updates',
      description: 'Review the proposed notes and evidence before making a decision.',
    };
  if (!c.adding)
    return {
      title: 'Profile sources',
      description: 'Manage the notes and projects behind your profile.',
    };
  if (!c.provider)
    return { title: 'Add a source', description: 'Choose where your notes or project live.' };
  if (!c.intent)
    return { title: 'Add from GitHub', description: 'What would you like to bring into Profile?' };
  if (c.intent === 'project')
    return {
      title: 'Watch a project',
      description:
        'Track changes for an authorized agent to investigate. Notes always need your review.',
    };
  return {
    title: c.provider === 'github' ? 'Import GitHub notes' : 'Import Google Drive notes',
    description: 'Choose a folder of factual notes about your background and work.',
  };
}

export function githubInput(repository: string, path: string, ref: string): ProfileSourceInput {
  let name = repository.trim();
  if (name.startsWith('https://')) {
    const url = new URL(name);
    if (url.hostname !== 'github.com' || url.username || url.password || url.search || url.hash)
      throw new Error('Use a GitHub repository URL or owner/repository.');
    name = url.pathname.replace(/^\/|\/$/g, '');
  }
  name = name.replace(/\.git$/, '');
  if (!/^[\w.-]+\/[\w.-]+$/.test(name))
    throw new Error('Use a repository URL such as https://github.com/owner/resumes.');
  return {
    provider: 'github',
    repository: name,
    path: path.trim().replace(/\/$/, ''),
    ...(ref.trim() ? { ref: ref.trim() } : {}),
  };
}
export function driveInput(value: string): ProfileSourceInput {
  let folderId = value.trim();
  if (folderId.startsWith('https://')) {
    const url = new URL(folderId);
    if (url.hostname !== 'drive.google.com' || url.username || url.password)
      throw new Error('Use a Google Drive folder link.');
    folderId = url.pathname.match(/\/folders\/([\w-]+)\/?$/)?.[1] ?? '';
  }
  if (!/^[\w-]{1,200}$/.test(folderId))
    throw new Error('Paste a Google Drive folder link or folder ID.');
  return { provider: 'drive', folderId };
}
export const importStatus = {
  new: 'Added',
  changed: 'Changed',
  unchanged: 'Up to date',
  conflict: 'Local edits',
};

/** Unchanged documents are never selectable in the changes-only review. */
export function importChanges(files: ProfileImportFile[]) {
  const order = { conflict: 0, changed: 1, new: 2, unchanged: 3 };
  return files
    .filter((file) => file.status !== 'unchanged')
    .sort((a, b) => order[a.status] - order[b.status] || a.path.localeCompare(b.path));
}
