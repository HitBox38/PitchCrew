import {
  cp,
  lstat,
  readFile,
  readdir,
  readlink,
  realpath,
  rename,
  rm,
  unlink,
} from 'node:fs/promises';
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';

export async function pruneRuntimeDependencies(runtime) {
  runtime = await realpath(runtime);
  const modules = join(runtime, 'node_modules');
  const visited = new Set();
  const needed = new Set();
  const queue = [join(runtime, 'packages/orchestrator')];
  const findDependency = async (folder, name) => {
    if (!/^(?:@[\w.-]+\/)?[\w.-]+$/.test(name)) throw new Error('Invalid dependency name.');
    for (let current = folder; current.startsWith(runtime); current = dirname(current)) {
      const candidate = join(current, 'node_modules', name);
      if (await lstat(join(candidate, 'package.json')).catch(() => null)) {
        const source = await realpath(candidate);
        const path = relative(runtime, source);
        if (path.startsWith('..') || isAbsolute(path))
          throw new Error('Runtime dependency escapes installation.');
        return source;
      }
      if (current === runtime) break;
    }
    return null;
  };
  while (queue.length) {
    const folder = queue.pop();
    if (visited.has(folder)) continue;
    visited.add(folder);
    const fromModules = relative(modules, folder);
    if (!fromModules.startsWith('..') && !isAbsolute(fromModules)) {
      const parts = fromModules.split(sep);
      needed.add(parts[0].startsWith('@') ? join(parts[0], parts[1]) : parts[0]);
    }
    const metadata = JSON.parse(await readFile(join(folder, 'package.json'), 'utf8'));
    const required = metadata.dependencies ?? {};
    for (const name of Object.keys({
      ...required,
      ...metadata.optionalDependencies,
      ...metadata.peerDependencies,
    })) {
      const dependency = await findDependency(folder, name);
      if (dependency) queue.push(dependency);
      else if (name in required && !(name in (metadata.optionalDependencies ?? {})))
        throw new Error(`Missing runtime dependency ${name} in ${metadata.name}.`);
    }
  }
  const removeUnused = async (name) => {
    if (needed.has(name)) return;
    const target = resolve(modules, name);
    const path = relative(modules, target);
    if (!path || path.startsWith('..') || isAbsolute(path))
      throw new Error('Invalid dependency cleanup path.');
    await rm(target, { recursive: true, force: true });
  };
  for (const name of await readdir(modules)) {
    if (name.startsWith('.')) continue;
    if (name.startsWith('@')) {
      for (const entry of await readdir(join(modules, name))) await removeUnused(join(name, entry));
    } else await removeUnused(name);
  }
}

// Ship ordinary workspace package directories: Windows installers cannot retain pnpm links.
export async function materializeWorkspacePackages(runtime) {
  runtime = await realpath(runtime);
  const packages = join(runtime, 'packages');
  for (const name of await readdir(packages)) {
    const scope = join(packages, name, 'node_modules/@pitchcrew');
    const aliases = await readdir(scope).catch(() => []);
    for (const alias of aliases) {
      const link = join(scope, alias);
      if (!(await lstat(link)).isSymbolicLink()) continue;
      const source = await realpath(resolve(dirname(link), await readlink(link)));
      if (dirname(source) !== packages) throw new Error('Workspace dependency escapes runtime.');
      const copy = `${link}-bundled`;
      await cp(source, copy, {
        recursive: true,
        filter: (path) => basename(path) !== 'node_modules',
      });
      await unlink(link);
      await rename(copy, link);
    }
  }
}
