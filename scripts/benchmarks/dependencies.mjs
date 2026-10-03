import { readFile, readdir, realpath, stat } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { join } from 'node:path';

async function packageBytes(directory) {
  let bytes = 0;
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.isSymbolicLink()) continue;
    const filename = join(directory, entry.name);
    bytes += entry.isDirectory() ? await packageBytes(filename) : (await stat(filename)).size;
  }
  return bytes;
}
export async function dependencyFootprint(workspace) {
  const visited = new Set();
  let bytes = 0,
    packages = 0;
  const visit = async (directory, thirdParty) => {
    directory = await realpath(directory);
    if (visited.has(directory)) return;
    visited.add(directory);
    const manifest = JSON.parse(await readFile(join(directory, 'package.json'), 'utf8'));
    if (thirdParty) {
      bytes += await packageBytes(directory);
      packages++;
    }
    const packageRequire = createRequire(join(directory, 'package.json'));
    for (const [name, specifier] of Object.entries({
      ...manifest.dependencies,
      ...manifest.optionalDependencies,
    })) {
      let target;
      for (const search of packageRequire.resolve.paths(name) ??
        packageRequire.resolve.paths('__pitchcrew_dependency__') ??
        []) {
        const path = join(search, name);
        try {
          await stat(join(path, 'package.json'));
          target = path;
          break;
        } catch {
          /* Try the next Node module search path. */
        }
      }
      if (!target) {
        if (name in (manifest.optionalDependencies ?? {})) continue;
        throw new Error(`Missing production dependency: ${name}`);
      }
      await visit(target, !specifier.startsWith('workspace:'));
    }
  };
  await visit(join(workspace, 'packages/orchestrator'), false);
  return { uniqueThirdPartyPackages: packages, logicalFileBytes: bytes };
}
