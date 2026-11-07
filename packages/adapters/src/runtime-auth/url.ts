/** OAuth links are temporary UI actions, never diagnostics or retained CLI output. */
export const nativeSignInUrl = (
  runtime: 'codex' | 'claude-code' | 'cursor-agent' | 'grok',
  value: unknown,
): string => {
  if (typeof value !== 'string' || value.length > 8192)
    throw new Error('The runtime returned an invalid sign-in link.');
  const url = new URL(value);
  const hosts =
    runtime === 'codex'
      ? ['auth.openai.com', 'chatgpt.com']
      : runtime === 'claude-code'
        ? ['claude.ai', 'console.anthropic.com', 'platform.claude.com']
        : runtime === 'cursor-agent'
          ? ['cursor.com', 'www.cursor.com', 'auth.cursor.com', 'auth.cursor.sh', 'cursor.sh']
          : ['accounts.x.ai', 'auth.x.ai', 'x.ai', 'grok.com', 'www.grok.com'];
  if (
    url.protocol !== 'https:' ||
    !hosts.includes(url.hostname) ||
    url.port ||
    url.username ||
    url.password
  )
    throw new Error('The runtime returned an unsupported sign-in link.');
  return url.href;
};
