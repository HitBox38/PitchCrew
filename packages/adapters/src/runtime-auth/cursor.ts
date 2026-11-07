import { stripVTControlCharacters } from 'node:util';
import { signInChild } from './process.ts';
import { nativeSignInUrl } from './url.ts';
import type { NativeSignInOptions, NativeSignInProcess } from './types.ts';

/** Cursor's auth-only command; no chat, filesystem or shell tools are started. */
export const cursorSignIn = (options: NativeSignInOptions): NativeSignInProcess => {
  const child = signInChild(['login'], {
    ...options,
    env: { ...options.env, NO_OPEN_BROWSER: '1' },
  });
  let buffer = '',
    previous = '';
  const receive = (chunk: string) => {
    buffer = (buffer + stripVTControlCharacters(chunk)).slice(-16_384);
    // Wait for a delimiter: opening a URL from a partial stdout chunk can lose its OAuth state.
    for (const match of buffer.matchAll(/https:\/\/[^\s<>"']+(?=[\s<>"'])/g)) {
      const candidate = new URL(match[0]);
      if (!/auth|login|device/i.test(candidate.pathname)) continue;
      const url = nativeSignInUrl('cursor-agent', match[0]);
      if (url !== previous) {
        previous = url;
        options.onAction({ url });
      }
    }
  };
  child.receive(child.stdout, receive);
  child.receive(child.stderr, receive);
  return {
    completion: child.completion,
    respond: () => {
      throw new Error('Cursor uses its browser callback.');
    },
  };
};
