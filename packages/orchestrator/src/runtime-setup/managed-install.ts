import { access, lstat, mkdir, readFile, realpath } from 'node:fs/promises';
import { constants } from 'node:fs';
import { isAbsolute, join, relative, sep } from 'node:path';
import { nodeExecutable } from '@pitchcrew/core/isolated-worker';
import type { RuntimeId } from '@pitchcrew/core';
import {
  findRuntimeExecutable,
  maintenanceDefinitions,
  npmCliEntry,
  type MaintenanceCommand,
} from '@pitchcrew/adapters';

export const managedPrefix = (directory: string, id: RuntimeId) => join(directory, 'runtimes', id);
export const ensureManagedPrefix = async (directory: string, id: RuntimeId) => {
  const root = await realpath(directory);
  const runtimes = join(directory, 'runtimes');
  await mkdir(runtimes, { recursive: true, mode: 0o700 });
  if ((await lstat(runtimes)).isSymbolicLink())
    throw new Error('The runtime installation folder cannot be a symbolic link.');
  const prefix = managedPrefix(directory, id);
  await mkdir(prefix, { recursive: true, mode: 0o700 });
  if ((await lstat(prefix)).isSymbolicLink())
    throw new Error('The runtime installation folder cannot be a symbolic link.');
  const resolved = await realpath(prefix);
  const displacement = relative(root, resolved);
  if (displacement === '..' || displacement.startsWith('..' + sep) || isAbsolute(displacement))
    throw new Error('The runtime installation folder escaped this workspace.');
};
export const npmCli = async (): Promise<string | null> => {
  const executable = await findRuntimeExecutable('npm');
  if (!executable) return null;
  return npmCliEntry(executable);
};
export const managedInstallCommand = (
  npm: string,
  directory: string,
  id: RuntimeId,
  version: string,
): MaintenanceCommand => {
  if (id === 'demo' || !maintenanceDefinitions[id].package || !/^\d+\.\d+\.\d+$/.test(version))
    throw new Error('This runtime does not have a supported managed installation.');
  return {
    file: nodeExecutable(),
    args: [
      npm,
      'install',
      '--global',
      '--prefix',
      managedPrefix(directory, id),
      '--no-audit',
      '--no-fund',
      '--registry',
      'https://registry.npmjs.org',
      `${maintenanceDefinitions[id].package}@${version}`,
    ],
  };
};
export const managedExecutable = async (directory: string, id: RuntimeId): Promise<string> => {
  if (id === 'demo' || !maintenanceDefinitions[id].package)
    throw new Error('Unsupported managed runtime.');
  const definition = maintenanceDefinitions[id];
  const prefix = managedPrefix(directory, id);
  const packageRoot = join(
    prefix,
    process.platform === 'win32' ? 'node_modules' : 'lib/node_modules',
    definition.package!,
  );
  const metadata = JSON.parse(await readFile(join(packageRoot, 'package.json'), 'utf8')) as {
    name?: unknown;
    bin?: unknown;
  };
  if (metadata.name !== definition.package || !metadata.bin || typeof metadata.bin !== 'object')
    throw new Error('The installed package identity could not be verified.');
  const entry = (metadata.bin as Record<string, unknown>)[definition.command];
  if (typeof entry !== 'string' || isAbsolute(entry))
    throw new Error('The installed runtime entry could not be verified.');
  const target = join(packageRoot, entry);
  const displacement = relative(packageRoot, target);
  if (displacement === '..' || displacement.startsWith('..' + sep) || isAbsolute(displacement))
    throw new Error('The installed runtime entry escaped its package.');
  // Adopt the npm shim: it preserves package launcher behavior, and the adapter executes its JS entry without a shell on Windows.
  const executable =
    process.platform === 'win32'
      ? join(prefix, `${definition.command}.cmd`)
      : join(prefix, 'bin', definition.command);
  await access(executable, process.platform === 'win32' ? constants.R_OK : constants.X_OK);
  await access(target, constants.R_OK);
  return executable;
};
