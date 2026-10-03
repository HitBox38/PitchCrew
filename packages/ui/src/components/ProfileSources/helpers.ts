import type { ProfileSourceInput } from '@pitchcrew/core';

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
  new: 'New document',
  changed: 'Source changed',
  unchanged: 'Up to date',
  conflict: 'Local edits — selecting replaces your saved copy',
};
