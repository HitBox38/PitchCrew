import type { RuntimeAuthMethod, RuntimeId } from '@pitchcrew/core';

/** Declared capabilities only. No arbitrary command or runtime can be supplied by a client. */
const methods: Partial<Record<RuntimeId, RuntimeAuthMethod[]>> = {
  codex: [
    {
      id: 'chatgpt',
      label: 'Sign in with ChatGPT',
      kind: 'browser',
      description:
        'Uses the native Codex account. API keys and provider configuration remain separate authentication options.',
    },
  ],
  'claude-code': [
    {
      id: 'claude',
      label: 'Sign in with Claude',
      kind: 'browser',
      description:
        'Uses the native Claude account. Configured API keys or alternate providers can take precedence.',
    },
  ],
  'cursor-agent': [
    {
      id: 'cursor',
      label: 'Sign in with Cursor',
      kind: 'browser',
      description: 'A configured Cursor API key takes precedence over browser sign-in.',
    },
  ],
  opencode: [
    {
      id: 'native',
      label: 'Sign in with OpenCode',
      kind: 'terminal',
      description: 'Choose a provider in the native sign-in terminal.',
    },
  ],
  'copilot-cli': [{ id: 'native', label: 'Sign in with GitHub Copilot', kind: 'terminal' }],
  grok: [
    {
      id: 'device',
      label: 'Sign in with xAI',
      kind: 'terminal',
      description:
        'The CLI shows a device code for your browser. This workspace’s OAuth account takes precedence over XAI_API_KEY; sign out to use the key instead.',
    },
  ],
};

export const nativeRuntimeAuthMethods = (runtime: RuntimeId): RuntimeAuthMethod[] =>
  structuredClone(methods[runtime] ?? []);
export const nativeRuntimeAuthCredentialScope = (runtime: RuntimeId): 'native' | 'workspace' =>
  runtime === 'grok' ? 'workspace' : 'native';

export const nativeRuntimeAuthMethod = (runtime: RuntimeId, methodId?: string) => {
  const available = nativeRuntimeAuthMethods(runtime);
  const method = methodId ? available.find((item) => item.id === methodId) : available[0];
  if (!method) throw new Error('This sign-in method is not supported by the selected runtime.');
  return method;
};
