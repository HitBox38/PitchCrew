import type { RuntimeId } from '@pitchcrew/core';
import { access, readFile, realpath } from 'node:fs/promises';
import { constants } from 'node:fs';
import { delimiter, dirname, isAbsolute, join, resolve, sep } from 'node:path';
import { homedir } from 'node:os';
import { cliEnvironment } from '../process/environment.ts';
import { maintenanceDefinitions } from './catalog.ts';
import { runMaintenanceCommand, type MaintenanceCommand } from './process.ts';
export const findRuntimeExecutable = async (command: string): Promise<string | null> => {
  const env = cliEnvironment();
  const path = Object.entries(env).find(([key]) => key.toUpperCase() === 'PATH')?.[1] ?? '';
  const extensions = process.platform === 'win32' ? ['.exe', '.cmd', '.bat', ''] : [''];
  for (const directory of path.split(delimiter).filter(isAbsolute))
    for (const extension of extensions) {
      const candidate = join(directory, command + extension);
      try {
        await access(candidate, process.platform === 'win32' ? constants.F_OK : constants.X_OK);
        return candidate;
      } catch {
        /* Continue PATH search. */
      }
    }
  return null;
};

export const resolveRuntimeInstallation = async (
  id: Exclude<RuntimeId, 'demo'>,
  signal?: AbortSignal,
): Promise<RuntimeInstallation | null> => {
  const definition = maintenanceDefinitions[id];
  const executable = await findRuntimeExecutable(definition.command);
  if (!executable) return null;
  const realPath = await realpath(executable);
  const path = normalized(realPath);
  const base: RuntimeInstallation = {
    executable,
    realPath,
    identity: `${executable}\0${realPath}`,
    installer: 'manual',
    manualCommand: '',
    detail:
      'Use the original installer to update this runtime. Its installation method could not be verified.',
  };
  if (
    /(?:^|\/)(?:mise|\.local\/share\/mise|\.volta|\.nix-profile|nix\/store|\.bun|pnpm|yarn)(?:\/|$)/.test(
      path,
    )
  )
    return {
      ...base,
      detail:
        'This installation is pinned or managed by another installer. Update it through that installer.',
    };

  if (definition.package) {
    const suffix = `/lib/node_modules/${definition.package}/`;
    const index = path.indexOf(suffix);
    let prefix = index >= 0 ? realPath.slice(0, index) : null;
    // Windows npm shims live next to node_modules. Only accept the exact package's shim.
    if (process.platform === 'win32' && /\.(?:cmd|bat)$/i.test(executable)) {
      const shim = await readFile(executable, 'utf8');
      const packagePath = `node_modules\\${definition.package.replaceAll('/', '\\')}\\`;
      if (shim.length < 16_000 && shim.includes(packagePath) && shim.includes('%dp0%'))
        prefix = dirname(executable);
    }
    if (prefix !== null) {
      const npm = await findRuntimeExecutable('npm');
      const candidates = [
        join(prefix, 'lib/node_modules/npm/bin/npm-cli.js'),
        join(prefix, 'node_modules/npm/bin/npm-cli.js'),
      ];
      if (npm && !/\.(cmd|bat)$/i.test(npm)) candidates.push(await realpath(npm));
      for (const cli of candidates) {
        if (!normalized(cli).endsWith('/npm/bin/npm-cli.js')) continue;
        try {
          await access(cli);
        } catch {
          continue;
        }
        const writable = await access(prefix, constants.W_OK).then(
          () => true,
          () => false,
        );
        return {
          ...base,
          installer: 'npm',
          lockKey: `npm:${prefix}`,
          identity: `${base.identity}\0npm\0${prefix}\0${cli}`,
          ...(writable
            ? {
                command: {
                  file: process.execPath,
                  args: [
                    cli,
                    'install',
                    '--global',
                    '--prefix',
                    prefix,
                    '--no-audit',
                    '--no-fund',
                    `${definition.package}@latest`,
                  ],
                },
              }
            : {}),
          manualCommand: `npm install --global --prefix ${shellQuote(prefix)} ${definition.package}@latest`,
          detail: writable
            ? 'Updates the existing npm installation.'
            : 'This npm prefix needs additional permissions. Update manually.',
        };
      }
    }
  }
  if (definition.brew && /\/(Cellar|Caskroom)\//.test(path)) {
    const brew = await findRuntimeExecutable('brew');
    if (brew) {
      const prefixResult = await runMaintenanceCommand(
        { file: brew, args: ['--prefix'] },
        { signal },
      );
      const prefix = prefixResult.stdout.trim();
      const cask = within(realPath, join(prefix, 'Caskroom', definition.brew));
      const formula = within(realPath, join(prefix, 'Cellar', definition.brew));
      if (prefixResult.code === 0 && isAbsolute(prefix) && (cask || formula)) {
        const kind = cask ? '--cask' : '--formula';
        const info = await runMaintenanceCommand(
          {
            file: brew,
            args: ['info', '--json=v2', kind, definition.brew],
            env: { HOMEBREW_NO_AUTO_UPDATE: '1', HOMEBREW_NO_ANALYTICS: '1' },
          },
          { signal },
        );
        const data = JSON.parse(info.stdout) as {
          formulae?: { pinned?: boolean; versions?: { stable?: string } }[];
          casks?: { version?: string }[];
        };
        const pinned = data.formulae?.[0]?.pinned === true;
        return {
          ...base,
          installer: 'homebrew',
          lockKey: `homebrew:${prefix}`,
          identity: `${base.identity}\0${brew}\0${prefix}\0${kind}\0${pinned}`,
          latest: cask ? data.casks?.[0]?.version : data.formulae?.[0]?.versions?.stable,
          ...(!pinned
            ? {
                command: {
                  file: brew,
                  args: ['upgrade', kind, definition.brew],
                  env: {
                    HOMEBREW_NO_AUTO_UPDATE: '1',
                    HOMEBREW_NO_ANALYTICS: '1',
                    HOMEBREW_NO_INSTALL_CLEANUP: '1',
                  },
                },
              }
            : {}),
          manualCommand: `brew upgrade ${kind} ${definition.brew}`,
          detail: pinned
            ? 'This Homebrew formula is pinned. Manage its pin in Homebrew.'
            : 'Updates the existing Homebrew installation.',
        };
      }
    }
  }
  if (
    definition.native &&
    definition.native.paths.some((part) => path.startsWith(normalized(resolve(homedir())) + part))
  ) {
    return {
      ...base,
      installer: 'native',
      identity: `${base.identity}\0native`,
      command: { file: executable, args: definition.native.args },
      manualCommand: `${definition.command} ${definition.native.args.join(' ')}`,
      detail: 'Uses the runtime’s native updater.',
    };
  }
  return base;
};

export interface RuntimeInstallation {
  executable: string;
  realPath: string;
  identity: string;
  lockKey?: string;
  installer: 'npm' | 'homebrew' | 'native' | 'manual';
  command?: MaintenanceCommand;
  manualCommand: string;
  detail: string;
  latest?: string;
}
const normalized = (path: string) => path.replaceAll('\\', '/');
const shellQuote = (value: string) =>
  process.platform === 'win32'
    ? `'${value.replaceAll("'", "''")}'`
    : `'${value.replaceAll("'", "'\\''")}'`;
const within = (path: string, directory: string) => path.startsWith(directory + sep);
