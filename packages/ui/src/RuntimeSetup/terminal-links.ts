import type { RuntimeId } from '@pitchcrew/core';

const hosts: Partial<Record<RuntimeId, readonly string[]>> = {
  codex: ['auth.openai.com', 'chatgpt.com'],
  'claude-code': ['claude.ai', 'console.anthropic.com', 'platform.claude.com'],
  'cursor-agent': ['cursor.com', 'www.cursor.com', 'auth.cursor.com', 'auth.cursor.sh'],
  'copilot-cli': ['github.com', 'login.microsoftonline.com', 'microsoft.com'],
  grok: ['accounts.x.ai', 'auth.x.ai', 'x.ai', 'grok.com', 'www.grok.com'],
  opencode: [
    'opencode.ai',
    'auth.openai.com',
    'chatgpt.com',
    'claude.ai',
    'console.anthropic.com',
    'platform.claude.com',
    'accounts.google.com',
    'github.com',
  ],
};

export const terminalPlainText = (output: string) =>
  // eslint-disable-next-line no-control-regex -- Strip native VT presentation before exposing copy/link actions.
  output.replace(/\u001b\[[0-?]*[ -/]*[@-~]/g, '');

/** Explicit clicks only; terminal output cannot open an arbitrary host or protocol. */
export const terminalSignInActions = (runtime: RuntimeId, output: string) => {
  const plain = terminalPlainText(output);
  const links = new Set<string>();
  // eslint-disable-next-line no-control-regex -- Control bytes must terminate a native terminal URL.
  for (const match of plain.matchAll(/https:\/\/[^\s<>"'\u0000-\u001f]+/g)) {
    try {
      const url = new URL(match[0].replace(/[),.;]+$/, ''));
      if (hosts[runtime]?.includes(url.hostname) && !url.username && !url.password && !url.port)
        links.add(url.href);
    } catch {
      /* Incomplete native output is not a link. */
    }
  }
  const codes = new Set<string>();
  for (const match of plain.matchAll(/\bcode\s*[:=]\s*([A-Z0-9]{4}-[A-Z0-9]{4}|[0-9]{6,8})\b/gi))
    codes.add(match[1]);
  return { links: [...links].slice(0, 4), codes: [...codes].slice(0, 4), plain };
};
