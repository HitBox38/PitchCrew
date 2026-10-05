import { afterEach, expect, test } from 'vitest';
import { createRequire } from 'node:module';
import { lstat, mkdir, mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';

const { pruneRuntimeDependencies, materializeWorkspacePackages } = createRequire(import.meta.url)(
  '../../../scripts/installer-runtime.mjs',
) as {
  pruneRuntimeDependencies(runtime: string): Promise<void>;
  materializeWorkspacePackages(runtime: string): Promise<void>;
};
const directories: string[] = [];
async function workspace() {
  const directory = await mkdtemp(join(tmpdir(), 'pitchcrew-installer-'));
  directories.push(directory);
  return directory;
}
async function packageAt(path: string, name: string, extra: Record<string, unknown> = {}) {
  await mkdir(path, { recursive: true });
  await writeFile(join(path, 'package.json'), JSON.stringify({ name, version: '1.0.0', ...extra }));
}
afterEach(async () => {
  for (const directory of directories.splice(0)) {
    if (
      dirname(directory) !== resolve(tmpdir()) ||
      !basename(directory).startsWith('pitchcrew-installer-')
    )
      throw new Error('Unsafe fixture cleanup path.');
    await rm(directory, { recursive: true, force: true });
  }
});

test('keeps transitive, nested, optional and installed peer dependencies while dropping unused UI packages', async () => {
  const directory = await workspace();
  const modules = join(directory, 'node_modules');
  await packageAt(join(directory, 'packages/orchestrator'), '@pitchcrew/orchestrator', {
    dependencies: { alpha: '1.0.0' },
  });
  await packageAt(join(modules, 'alpha'), 'alpha', {
    dependencies: { leaf: '1.0.0' },
    optionalDependencies: { native: '1.0.0', absent: '1.0.0' },
    peerDependencies: { peer: '1.0.0' },
  });
  await packageAt(join(modules, 'alpha/node_modules/leaf'), 'leaf');
  for (const name of ['native', 'peer', 'unused-ui', '@example/unused-font'])
    await packageAt(join(modules, name), name);
  await pruneRuntimeDependencies(directory);
  for (const name of ['alpha', 'native', 'peer', 'alpha/node_modules/leaf'])
    expect((await lstat(join(modules, name))).isDirectory()).toBe(true);
  for (const name of ['unused-ui', '@example/unused-font'])
    await expect(lstat(join(modules, name))).rejects.toMatchObject({ code: 'ENOENT' });
});

test('rejects missing required dependencies before removing files', async () => {
  const directory = await workspace();
  await packageAt(join(directory, 'packages/orchestrator'), '@pitchcrew/orchestrator', {
    dependencies: { missing: '1.0.0' },
  });
  await packageAt(join(directory, 'node_modules/unused'), 'unused');
  await expect(pruneRuntimeDependencies(directory)).rejects.toThrow(
    'Missing runtime dependency missing',
  );
  expect((await lstat(join(directory, 'node_modules/unused'))).isDirectory()).toBe(true);
});

test('follows workspace dependencies and replaces their links with portable source directories', async () => {
  const directory = await workspace();
  const core = join(directory, 'packages/core');
  const scope = join(directory, 'packages/orchestrator/node_modules/@pitchcrew');
  await packageAt(join(directory, 'packages/orchestrator'), '@pitchcrew/orchestrator', {
    dependencies: { '@pitchcrew/core': 'workspace:*' },
  });
  await packageAt(core, '@pitchcrew/core', { dependencies: { leaf: '1.0.0' } });
  await mkdir(join(core, 'src'), { recursive: true });
  await writeFile(join(core, 'src/index.ts'), 'export const fixture = true;');
  await mkdir(join(core, 'node_modules'), { recursive: true });
  await packageAt(join(directory, 'node_modules/leaf'), 'leaf');
  await mkdir(scope, { recursive: true });
  await symlink(core, join(scope, 'core'), process.platform === 'win32' ? 'junction' : 'dir');
  await pruneRuntimeDependencies(directory);
  await materializeWorkspacePackages(directory);
  expect((await lstat(join(scope, 'core'))).isSymbolicLink()).toBe(false);
  expect(await readFile(join(scope, 'core/src/index.ts'), 'utf8')).toContain('fixture');
  await expect(lstat(join(scope, 'core/node_modules'))).rejects.toMatchObject({ code: 'ENOENT' });
  expect((await lstat(join(directory, 'node_modules/leaf'))).isDirectory()).toBe(true);
});
