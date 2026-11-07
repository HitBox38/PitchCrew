import { access, realpath } from 'node:fs/promises';
import { constants } from 'node:fs';
import { dirname, join } from 'node:path';

/** Resolve an installed npm executable or its standard Windows launcher to its Node entry. */
export const npmCliEntry = async (executable: string): Promise<string | null> => {
  const path = await realpath(executable);
  for (const candidate of [path, join(dirname(path), 'node_modules/npm/bin/npm-cli.js')]) {
    if (!candidate.replaceAll('\\', '/').endsWith('/npm/bin/npm-cli.js')) continue;
    try {
      await access(candidate, constants.R_OK);
      return candidate;
    } catch {
      // Unrecognized layouts remain manual; never execute a shell shim.
    }
  }
  return null;
};
