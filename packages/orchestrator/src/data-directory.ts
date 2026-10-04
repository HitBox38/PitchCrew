import { isAbsolute, relative, sep } from 'node:path';

/** Keep mutable application data outside the repository. */
export function assertDataDirectoryOutsideRepository(root: string, directory: string): void {
  const repoRelative = relative(root, directory);
  if (isAbsolute(repoRelative) || repoRelative === '..' || repoRelative.startsWith(`..${sep}`))
    return;
  throw new Error('PITCHCREW_HOME must be outside the repository.');
}
