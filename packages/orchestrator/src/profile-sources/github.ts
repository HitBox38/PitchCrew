import type { ProfileSourceInput } from '@pitchcrew/core';
import type { ConnectorManager } from '@pitchcrew/mcp/connectors';
import { MAX_FILES, MAX_FOLDERS, object, text, type RemoteFile } from './helpers.ts';

export async function readGithubSource(
  manager: ConnectorManager,
  input: Extract<ProfileSourceInput, { provider: 'github' }>,
  signal: AbortSignal,
): Promise<{ label: string; files: RemoteFile[] }> {
  const [owner, repo] = input.repository.split('/');
  const resolved = await manager.call(
    'github_get_revision',
    { owner, repo, ref: input.ref },
    signal,
  );
  const ref = text(resolved.sha);
  if (!/^[a-f0-9]{40}$/.test(ref)) throw new Error('Could not resolve the repository revision.');
  const files: RemoteFile[] = [];
  const queue = [input.path];
  let folders = 0;
  while (queue.length) {
    if (++folders > MAX_FOLDERS)
      throw new Error('Too many folders. Choose a smaller source folder.');
    const path = queue.shift()!;
    const listing = await manager.call('github_read_file', { owner, repo, path, ref }, signal);
    if (!Array.isArray(listing.entries))
      throw new Error('Choose a repository folder, rather than a file.');
    if (listing.entries.length >= 1000)
      throw new Error('This folder listing may be incomplete. Choose a smaller folder.');
    for (const raw of listing.entries) {
      const entry = object(raw);
      const child = text(entry.path);
      if (
        (path && !child.startsWith(path + '/')) ||
        child.split('/').some((part) => part === '..' || part === '.')
      )
        throw new Error('Invalid repository file path.');
      if (entry.type === 'dir') {
        // Runtime instructions and application outputs are not profile facts.
        if (
          !/(^|\/)(\.git|\.agents|\.claude|\.cursor|node_modules|resumes|data|tools)(\/|$)/.test(
            child,
          )
        )
          queue.push(child);
      } else if (
        entry.type === 'file' &&
        /\.(md|txt)$/i.test(child) &&
        !/(^|\/)(AGENTS|CLAUDE|SKILL)\.md$/i.test(child)
      ) {
        if (files.length >= MAX_FILES)
          throw new Error('Too many documents. Choose a smaller source folder.');
        if (typeof entry.size === 'number' && entry.size > 200000)
          throw new Error(`${child} is too large. Choose a smaller source folder.`);
        const result = await manager.call(
          'github_read_file',
          { owner, repo, path: child, ref },
          signal,
        );
        files.push({
          key: child,
          path: child,
          content: text(result.text),
          revision: text(result.sha),
          url: `https://github.com/${owner}/${repo}/blob/${ref}/${child.split('/').map(encodeURIComponent).join('/')}`,
        });
      }
    }
  }
  return { label: `${input.repository}/${input.path || ''}`, files };
}
