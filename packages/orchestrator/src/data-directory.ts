import { realpathSync } from 'node:fs';
import { basename, dirname, isAbsolute, relative, resolve, sep } from 'node:path';

const boundaryMessage = 'PITCHCREW_HOME must be outside the repository.';

function isOutside(root: string, directory: string): boolean {
  const repoRelative = relative(root, directory);
  return isAbsolute(repoRelative) || repoRelative === '..' || repoRelative.startsWith(`..${sep}`);
}

/** Resolve existing ancestors even when the data directory has not been created yet. */
function physicalPath(path: string): string {
  let ancestor = resolve(path);
  const missing: string[] = [];
  for (;;) {
    try {
      return resolve(realpathSync(ancestor), ...missing.reverse());
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
      const parent = dirname(ancestor);
      if (parent === ancestor) throw error;
      missing.push(basename(ancestor));
      ancestor = parent;
    }
  }
}

/** Keep mutable application data outside the repository, including filesystem aliases. */
export function assertDataDirectoryOutsideRepository(root: string, directory: string): void {
  if (!isOutside(root, directory)) throw new Error(boundaryMessage);
  let physicalRoot: string;
  let physicalDirectory: string;
  try {
    physicalRoot = physicalPath(root);
    physicalDirectory = physicalPath(directory);
  } catch (error) {
    throw new Error(`${boundaryMessage} Could not verify its physical location.`, { cause: error });
  }
  if (!isOutside(physicalRoot, physicalDirectory)) throw new Error(boundaryMessage);
}
