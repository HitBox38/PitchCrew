import type { RuntimeId } from '@pitchcrew/core';
import { lstatSync } from 'node:fs';
import { join } from 'node:path';
import {
  runtimeConnectionEnvironment,
  runtimeConnectionDirectory,
} from '../process/runtime-connection.ts';
import { signInChild } from './process.ts';
import type { NativeSignInOptions, NativeSignInProcess } from './types.ts';

export const nativeRuntimeCanLogout = (runtime: RuntimeId) => {
  const environment = runtimeConnectionEnvironment();
  if (runtime === 'codex') return !environment.CODEX_API_KEY;
  if (runtime === 'claude-code')
    return !environment.ANTHROPIC_API_KEY && !environment.ANTHROPIC_AUTH_TOKEN;
  if (runtime === 'cursor-agent')
    return !environment.CURSOR_API_KEY && !environment.CURSOR_AUTH_TOKEN;
  if (runtime === 'grok') {
    const directory = runtimeConnectionDirectory();
    if (!directory) return false;
    try {
      const file = lstatSync(join(directory, 'auth.json'));
      return file.isFile() && !file.isSymbolicLink();
    } catch {
      return false;
    }
  }
  return false;
};

export const nativeSignOut = (
  runtime: RuntimeId,
  options: NativeSignInOptions,
): NativeSignInProcess => {
  if (!nativeRuntimeCanLogout(runtime))
    throw new Error('This runtime does not offer native sign-out for its current authentication.');
  const args =
    runtime === 'claude-code'
      ? ['--setting-sources', '', 'auth', 'logout']
      : runtime === 'grok'
        ? ['--no-auto-update', 'logout']
        : ['logout'];
  const child = signInChild(
    args,
    runtime === 'grok'
      ? {
          ...options,
          env: {
            ...options.env,
            GROK_HOME: runtimeConnectionDirectory(),
            GROK_DISABLE_AUTOUPDATER: '1',
            GROK_AUTH: undefined,
            GROK_CONFIG: undefined,
            GROK_CONFIG_PATH: undefined,
            GROK_AGENT: undefined,
          },
        }
      : options,
  );
  child.receive(child.stdout, () => {});
  child.receive(child.stderr, () => {});
  return {
    completion: child.completion,
    respond: () => {
      throw new Error('Sign-out does not accept input.');
    },
  };
};
