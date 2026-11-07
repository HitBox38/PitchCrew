import type { RuntimeId } from '@pitchcrew/core';
import { codexSignIn } from './codex.ts';
import { claudeSignIn } from './claude.ts';
import { cursorSignIn } from './cursor.ts';
import {
  nativeRuntimeAuthMethod,
  nativeRuntimeAuthMethods,
  nativeRuntimeAuthCredentialScope,
} from './methods.ts';
import { terminalSignIn } from './terminal.ts';
import { nativeRuntimeCanLogout, nativeSignOut } from './logout.ts';
import { discoverGrokAuthMethods, grokAcpSignIn } from './grok-acp.ts';
import type { NativeSignInOptions, NativeSignInProcess } from './types.ts';

export type { NativeSignInAction, NativeSignInOptions, NativeSignInProcess } from './types.ts';
export { nativeRuntimeAuthMethods, nativeRuntimeCanLogout, nativeRuntimeAuthCredentialScope };
export const startNativeRuntimeSignOut = nativeSignOut;
export const discoverNativeRuntimeAuthMethods = async (
  runtime: RuntimeId,
  options: NativeSignInOptions,
) => {
  const declared = nativeRuntimeAuthMethods(runtime);
  if (runtime !== 'grok') return declared;
  try {
    return [...declared, ...(await discoverGrokAuthMethods(options))];
  } catch {
    return declared;
  }
};
export const supportsNativeSignIn = (runtime: RuntimeId) =>
  nativeRuntimeAuthMethods(runtime).length > 0;
export const startNativeRuntimeSignIn = (
  runtime: RuntimeId,
  options: NativeSignInOptions,
): NativeSignInProcess => {
  if (runtime === 'grok' && options.methodId?.startsWith('acp:')) return grokAcpSignIn(options);
  nativeRuntimeAuthMethod(runtime, options.methodId);
  if (runtime === 'codex') return codexSignIn(options);
  if (runtime === 'claude-code') return claudeSignIn(options);
  if (runtime === 'cursor-agent') return cursorSignIn(options);
  if (['opencode', 'copilot-cli', 'grok'].includes(runtime))
    return terminalSignIn(runtime, options);
  throw new Error('This runtime uses its CLI sign-in instructions.');
};
