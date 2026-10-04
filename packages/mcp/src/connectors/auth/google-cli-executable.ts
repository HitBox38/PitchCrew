import { access, realpath } from 'node:fs/promises';
import { basename, delimiter, dirname, join } from 'node:path';

// Run the installed native binary directly, including npm installations. This
// avoids shell wrappers, auto-installation and wrapper subprocesses on Windows.
export async function googleCliExecutable() {
  const binary = process.platform === 'win32' ? 'gws.exe' : 'gws';
  for (const folder of (process.env.PATH ?? '').split(delimiter).filter(Boolean)) {
    const candidates = [
      join(folder, binary),
      join(folder, 'node_modules', '@googleworkspace', 'cli', 'bin', binary),
    ];
    for (const candidate of candidates) {
      try {
        const resolved = await realpath(candidate);
        const executable =
          basename(resolved) === 'run.js' ? join(dirname(resolved), 'bin', binary) : resolved;
        await access(executable);
        return executable;
      } catch {
        /* Try the next installed location. */
      }
    }
  }
  return undefined;
}
