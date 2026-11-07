import { randomUUID } from 'node:crypto';
import { writeFile, rename, rm } from 'node:fs/promises';
import { join, parse } from 'node:path';
import { homedir } from 'node:os';
import { runtimeConnectionDirectory } from '../process/runtime-connection.ts';
import { acpSignIn, discoverAcpAuthMethods, type AcpAuthOptions } from './acp.ts';
import { nativeSignInUrl } from './url.ts';
import type { NativeSignInOptions, NativeSignInProcess } from './types.ts';

/** A fixed, private Grok invocation. The agent never receives arbitrary launch arguments. */
const optionsForGrok = async (options: NativeSignInOptions): Promise<AcpAuthOptions> => {
  const directory = runtimeConnectionDirectory();
  if (!directory) throw new Error('The private runtime authentication folder is unavailable.');
  const temporary = join(directory, `.config-${randomUUID()}.tmp`);
  try {
    await writeFile(
      temporary,
      [
        '[claude_compat]',
        'imported = true',
        '[cli]',
        'auto_update = false',
        '[telemetry]',
        'trace_upload = false',
        '[session]',
        'load_envrc = false',
        '[memory]',
        'enabled = false',
        '[subagents]',
        'enabled = false',
        '[skills]',
        `ignore = ${JSON.stringify([...new Set([parse(homedir()).root, parse(directory).root])])}`,
      ].join('\n') + '\n',
      { mode: 0o600, flag: 'wx' },
    );
    await rename(temporary, join(directory, 'config.toml'));
  } finally {
    await rm(temporary, { force: true });
  }
  return {
    ...options,
    args: [
      '--no-auto-update',
      '--tools',
      '',
      '--no-subagents',
      '--no-memory',
      '--disable-web-search',
      '--permission-mode',
      'dontAsk',
      'agent',
      'stdio',
    ],
    directory,
    env: {
      ...options.env,
      NO_OPEN_BROWSER: '1',
      BROWSER: 'none',
      GROK_HOME: directory,
      GROK_AUTH: undefined,
      GROK_CONFIG: undefined,
      GROK_CONFIG_PATH: undefined,
      GROK_AGENT: undefined,
      GROK_DISABLE_AUTOUPDATER: '1',
      ...Object.fromEntries(
        ['CLAUDE', 'CURSOR'].flatMap((vendor) =>
          ['SKILLS', 'RULES', 'AGENTS', 'MCPS', 'HOOKS'].map((feature) => [
            `GROK_${vendor}_${feature}_ENABLED`,
            '0',
          ]),
        ),
      ),
    },
    validateUrl: (url) => nativeSignInUrl('grok', url),
  };
};

export const discoverGrokAuthMethods = async (options: NativeSignInOptions) =>
  discoverAcpAuthMethods(await optionsForGrok({ ...options, timeout: 10_000 }));

export const grokAcpSignIn = (options: NativeSignInOptions): NativeSignInProcess => {
  let active: NativeSignInProcess | undefined;
  return {
    completion: optionsForGrok(options).then((prepared) => {
      active = acpSignIn(prepared);
      return active.completion;
    }),
    respond: () => {
      throw new Error('Use the current ACP authentication interaction.');
    },
    respondInteraction: (response) => {
      if (!active?.respondInteraction)
        throw new Error('The ACP authentication process is not waiting for input.');
      active.respondInteraction(response);
    },
  };
};
