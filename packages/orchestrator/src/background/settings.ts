import { homedir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { assertDataDirectoryOutsideRepository } from '../data-directory.ts';

export const defaultPort = 4417;
export const repositoryRoot = fileURLToPath(new URL('../../../../', import.meta.url));
export const cliEntry = fileURLToPath(new URL('../cli.ts', import.meta.url));

export interface DaemonSettings {
  directory: string;
  port: number;
}

/** Value of `--name value` in an argument list. */
export function flagValue(argv: readonly string[], name: string) {
  const index = argv.indexOf(name);
  return index >= 0 ? argv[index + 1] : undefined;
}

/**
 * Resolves the data folder and port the same way for the daemon, the service installer and the
 * desktop launcher. Command-line values are used by installed services, which cannot rely on the
 * login environment carrying PITCHCREW_HOME and PITCHCREW_PORT.
 */
export function resolveDaemonSettings(
  env: NodeJS.ProcessEnv = process.env,
  argv: readonly string[] = [],
  home = homedir(),
): DaemonSettings {
  const port = Number(flagValue(argv, '--port') ?? env.PITCHCREW_PORT ?? defaultPort);
  if (!Number.isInteger(port) || port < 1024 || port > 65535)
    throw new Error('PITCHCREW_PORT must be between 1024 and 65535.');
  const directory = resolve(
    flagValue(argv, '--home') ?? env.PITCHCREW_HOME ?? join(home, '.pitchcrew'),
  );
  assertDataDirectoryOutsideRepository(repositoryRoot, directory);
  return { directory, port };
}
