import type { RuntimeId } from '@pitchcrew/core';

export const runtimeVersion = (value: string): string | null => {
  return value.match(/\b\d+\.\d+\.\d+(?:-[\w.-]+)?\b/)?.[0] ?? null;
};
export const compareRuntimeVersions = (a: string, b: string): number | null => {
  const left = runtimeVersion(a),
    right = runtimeVersion(b);
  if (!left || !right) return null;
  for (let i = 0; i < 3; i++) {
    const delta = Number(left.split(/[.-]/)[i]) - Number(right.split(/[.-]/)[i]);
    if (delta) return Math.sign(delta);
  }
  return left.includes('-') === right.includes('-') ? 0 : left.includes('-') ? -1 : 1;
};

/** Match the adapters' enforced minimums; newer untested releases remain eligible. */
export const runtimeUpdateCompatible = (id: RuntimeId, version: string): boolean => {
  const minimum: Partial<Record<RuntimeId, string>> = {
    'cursor-agent': '2026.09.26',
    grok: '1.0.45',
    pi: '1.0.0',
    'oh-my-pi': '18.4.9',
    hermes: '0.21.5',
  };
  const required = minimum[id];
  return !required || (compareRuntimeVersions(version, required) ?? -1) >= 0;
};

export interface MaintenanceDefinition {
  command: string;
  package?: string;
  brew?: string;
  repository?: string;
  native?: { args: string[]; paths: string[] };
  instructions: string;
  login?: string;
}
/** Official distribution identities, never inferred from renderer input or CLI output. */
export const maintenanceDefinitions: Record<Exclude<RuntimeId, 'demo'>, MaintenanceDefinition> = {
  'claude-code': {
    command: 'claude',
    package: '@anthropic-ai/claude-code',
    brew: 'claude-code',
    native: { args: ['update'], paths: ['/.local/share/claude/', '/.local/bin/claude'] },
    instructions: 'Configure native Claude authentication, then recheck.',
    login: 'claude auth login',
  },
  codex: {
    command: 'codex',
    package: '@openai/codex',
    brew: 'codex',
    native: { args: ['update'], paths: ['/packages/standalone/'] },
    instructions:
      'Configure native Codex authentication or your configured provider, then recheck.',
    login: 'codex login',
  },
  'gemini-cli': {
    command: 'gemini',
    package: '@google/gemini-cli',
    brew: 'gemini-cli',
    instructions:
      'Configure Gemini native sign-in or its supported authentication environment, then recheck.',
    login: 'gemini',
  },
  opencode: {
    command: 'opencode',
    package: 'opencode-ai',
    brew: 'opencode',
    native: { args: ['upgrade'], paths: ['/.opencode/bin/opencode'] },
    instructions:
      'Configure the selected built-in provider in OpenCode. Custom provider configuration is not imported.',
    login: 'opencode auth login',
  },
  'copilot-cli': {
    command: 'copilot',
    package: '@github/copilot',
    brew: 'copilot-cli',
    instructions:
      'Configure native keychain or environment authentication. Pitchcrew does not import Copilot configuration-file tokens.',
    login: 'copilot login',
  },
  'cursor-agent': {
    command: 'cursor-agent',
    native: { args: ['update'], paths: ['/.local/share/cursor-agent/'] },
    instructions: 'Configure native Cursor authentication, then recheck.',
    login: 'cursor-agent login',
  },
  goose: {
    command: 'goose',
    brew: 'goose',
    repository: 'block/goose',
    instructions:
      'Configure native keyring or provider API-key environment authentication. User configuration files are not imported.',
  },
  'kiro-cli': {
    command: 'kiro-cli',
    brew: 'kiro-cli',
    instructions:
      'Set KIRO_API_KEY in the daemon or service environment and restart it. Existing Kiro login files are not imported.',
  },
  grok: {
    command: 'grok',
    package: '@xai-official/grok',
    brew: 'grok',
    native: { args: ['update'], paths: ['/.grok/bin/grok'] },
    instructions:
      'Set XAI_API_KEY in the daemon or service environment and restart it. Existing Grok login files are not imported.',
  },
  pi: {
    command: 'pi',
    package: '@earendil-works/pi-coding-agent',
    instructions:
      'Set the selected provider’s API key in the daemon or service environment and restart it. Pi login files and custom providers are not imported.',
  },
  'oh-my-pi': {
    command: 'omp',
    package: '@oh-my-pi/pi-coding-agent',
    instructions:
      'Set the selected provider’s API key in the daemon or service environment and restart it. OMP login files and custom providers are not imported.',
  },
  hermes: {
    command: 'hermes',
    repository: 'NousResearch/hermes-agent',
    instructions:
      'Set the selected provider’s API key in the daemon or service environment and restart it. Hermes login files and custom providers are not imported.',
  },
};
