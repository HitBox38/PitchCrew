import { randomUUID } from 'node:crypto';
import { tmpdir } from 'node:os';
import type { RuntimeId } from '@pitchcrew/core';
import { cliEnvironment } from '../process/environment.ts';
import { runtimeCommand } from '../process/executable.ts';
import { runtimeConnectionDirectory } from '../process/runtime-connection.ts';
import { startSignInTerminal } from '../process/sign-in-terminal.ts';
import type { NativeSignInOptions, NativeSignInProcess } from './types.ts';

const nativeArguments = (runtime: RuntimeId) => {
  if (runtime === 'opencode') return ['auth', 'login'];
  if (runtime === 'copilot-cli') return ['login'];
  if (runtime === 'grok') return ['--no-auto-update', 'login', '--device-auth'];
  throw new Error('This runtime has no supported sign-in terminal.');
};

/** Only declared auth-only commands run here. This terminal is never an agent tool or shell. */
export const terminalSignIn = (
  runtime: RuntimeId,
  options: NativeSignInOptions,
): NativeSignInProcess => {
  const id = randomUUID();
  let transcript = '',
    total = 0;
  const environment: NodeJS.ProcessEnv = { ...options.env, NO_OPEN_BROWSER: '1', BROWSER: 'none' };
  if (runtime === 'grok') {
    const directory = runtimeConnectionDirectory();
    if (!directory) throw new Error('The private runtime authentication folder is unavailable.');
    Object.assign(environment, {
      GROK_HOME: directory,
      GROK_DISABLE_AUTOUPDATER: '1',
      GROK_AUTH: undefined,
      GROK_CONFIG: undefined,
      GROK_CONFIG_PATH: undefined,
      GROK_AGENT: undefined,
    });
  }
  const invocation = runtimeCommand(options.command, [
    ...(options.prefix ?? []),
    ...nativeArguments(runtime),
  ]);
  const child = startSignInTerminal({
    command: invocation.file,
    args: invocation.args,
    cwd: tmpdir(),
    env: cliEnvironment(environment),
    signal: options.signal,
    timeout: options.timeout ?? 5 * 60_000,
    onOutput: (text) => {
      total += text.length;
      // The PTY helper emits an already-redacted stream. Publish its cumulative
      // end position so resumed terminals append the retained suffix correctly.
      transcript = (transcript + text).slice(-16_384);
      options.onAction({
        interaction: {
          id,
          type: 'terminal',
          output: transcript,
          outputOffset: total,
        },
      });
    },
  });
  return {
    completion: child.completion,
    respond: () => {
      throw new Error('Use the native sign-in terminal response.');
    },
    respondInteraction: (response) => {
      if (response.type !== 'terminal') throw new Error('This sign-in expects terminal input.');
      if (response.size) child.resize(response.size.cols, response.size.rows);
      child.write(response.data);
    },
  };
};
