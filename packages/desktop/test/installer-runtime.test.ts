import { afterEach, expect, test } from 'vitest';
import {
  pruneRuntimeDependencies,
  materializeWorkspacePackages,
} from '../../../scripts/installer-runtime.ts';
import { lstat, mkdir, mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
const workspace = async () => {
  const directory = await mkdtemp(join(tmpdir(), 'pitchcrew-installer-'));
  directories.push(directory);
  return directory;
};
const packageAt = async (path: string, name: string, extra: Record<string, unknown> = {}) => {
  await mkdir(path, { recursive: true });
  await writeFile(join(path, 'package.json'), JSON.stringify({ name, version: '1.0.0', ...extra }));
};

const directories: string[] = [];
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

test('retains desktop updater dependencies and their transitive packages in the bundled runtime', async () => {
  const directory = await workspace();
  await packageAt(join(directory, 'packages/orchestrator'), '@pitchcrew/orchestrator');
  await packageAt(join(directory, 'packages/desktop'), '@pitchcrew/desktop', {
    dependencies: { updater: '1.0.0' },
  });
  await packageAt(join(directory, 'node_modules/updater'), 'updater', {
    dependencies: { checksum: '1.0.0' },
  });
  await packageAt(join(directory, 'node_modules/checksum'), 'checksum');
  await packageAt(join(directory, 'node_modules/unused-ui'), 'unused-ui');
  await pruneRuntimeDependencies(directory, ['desktop']);
  expect((await lstat(join(directory, 'node_modules/updater'))).isDirectory()).toBe(true);
  expect((await lstat(join(directory, 'node_modules/checksum'))).isDirectory()).toBe(true);
  await expect(lstat(join(directory, 'node_modules/unused-ui'))).rejects.toMatchObject({
    code: 'ENOENT',
  });
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

test('retains and materializes Bun hoisted workspace links with transitive dependencies', async () => {
  const directory = await workspace();
  const core = join(directory, 'packages/core');
  const scope = join(directory, 'node_modules/@pitchcrew');
  await packageAt(join(directory, 'packages/orchestrator'), '@pitchcrew/orchestrator', {
    dependencies: { '@pitchcrew/core': 'workspace:*' },
  });
  await packageAt(core, '@pitchcrew/core', { dependencies: { leaf: '1.0.0' } });
  await mkdir(join(core, 'src'), { recursive: true });
  await writeFile(join(core, 'src/index.ts'), 'export const fixture = true;');
  await mkdir(join(core, 'node_modules'), { recursive: true });
  await packageAt(join(directory, 'node_modules/leaf'), 'leaf');
  await packageAt(join(directory, 'node_modules/unused-ui'), 'unused-ui');
  await mkdir(scope, { recursive: true });
  await symlink(core, join(scope, 'core'), process.platform === 'win32' ? 'junction' : 'dir');
  await pruneRuntimeDependencies(directory);
  expect((await lstat(join(scope, 'core'))).isSymbolicLink()).toBe(true);
  await materializeWorkspacePackages(directory);
  expect((await lstat(join(scope, 'core'))).isSymbolicLink()).toBe(false);
  expect(await readFile(join(scope, 'core/src/index.ts'), 'utf8')).toContain('fixture');
  await expect(lstat(join(scope, 'core/node_modules'))).rejects.toMatchObject({ code: 'ENOENT' });
  expect((await lstat(join(directory, 'node_modules/leaf'))).isDirectory()).toBe(true);
  await expect(lstat(join(directory, 'node_modules/unused-ui'))).rejects.toMatchObject({
    code: 'ENOENT',
  });
});

test('rejects root workspace links outside the staged workspace packages', async () => {
  const directory = await workspace();
  const source = join(directory, 'untrusted');
  const scope = join(directory, 'node_modules/@pitchcrew');
  await mkdir(join(directory, 'packages'), { recursive: true });
  await packageAt(source, '@pitchcrew/core');
  await mkdir(scope, { recursive: true });
  await symlink(source, join(scope, 'core'), process.platform === 'win32' ? 'junction' : 'dir');
  await expect(materializeWorkspacePackages(directory)).rejects.toThrow(
    'Workspace dependency escapes runtime.',
  );
  expect((await lstat(join(scope, 'core'))).isSymbolicLink()).toBe(true);
});
