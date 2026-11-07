import { stripVTControlCharacters } from 'node:util';
import type { NativeSignInOptions, NativeSignInProcess } from './types.ts';
import { signInChild } from './process.ts';
import { nativeSignInUrl } from './url.ts';

/** Native auth login owns OAuth and credential storage. Only its public URL and code prompt leave this helper.
 * https://code.claude.com/docs/en/troubleshoot-install#oauth-login-fails-in-wsl2-ssh-or-containers
 */
export const claudeSignIn = (options: NativeSignInOptions): NativeSignInProcess => {
  const process = signInChild(['--setting-sources', '', 'auth', 'login', '--claudeai'], options);
  let buffer = '',
    url: string | undefined,
    codeRequested = false;
  const receive = (chunk: string) => {
    buffer += stripVTControlCharacters(chunk);
    if (/Paste (?:the )?code here/i.test(buffer) && !codeRequested) {
      codeRequested = true;
      options.onAction({ codeRequested: true });
    }
    let end: number;
    while ((end = buffer.indexOf('\n')) >= 0) {
      const line = buffer.slice(0, end);
      buffer = buffer.slice(end + 1);
      for (const match of line.matchAll(/https:\/\/[^\s<>"']+/g)) {
        if (!new URL(match[0]).pathname.startsWith('/oauth/authorize')) continue;
        const candidate = nativeSignInUrl('claude-code', match[0]);
        if (candidate !== url) {
          url = candidate;
          options.onAction({ url });
        }
      }
    }
  };
  process.receive(process.stdout, receive);
  process.receive(process.stderr, receive);
  return {
    completion: process.completion,
    respond: (code: string) => {
      if (!codeRequested) throw new Error('Claude has not requested a sign-in code.');
      if (!/^[\x21-\x7e]{1,2048}$/.test(code))
        throw new Error('Paste the single-line code from Claude.');
      process.write(code + '\n');
      codeRequested = false;
      options.onAction({ codeRequested: false });
    },
  };
};
