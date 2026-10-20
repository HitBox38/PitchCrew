import type { RuntimeAuthentication, RuntimeConfiguration } from '@pitchcrew/core';
import { maintenanceDefinitions } from './catalog.ts';
import { findRuntimeExecutable } from './installation.ts';
import { runMaintenanceCommand } from './process.ts';
import { readCodexAccount } from './account.ts';
export const checkRuntimeAuthentication = async (
  config: Pick<RuntimeConfiguration, 'runtime' | 'model'>,
  signal?: AbortSignal,
): Promise<RuntimeAuthentication> => {
  const { runtime, model } = config;
  const checkedAt = new Date().toISOString();
  const definition = runtime === 'demo' ? null : maintenanceDefinitions[runtime];
  const base = {
    checkedAt,
    instructions: definition?.instructions ?? 'Demo does not require authentication.',
    ...(definition?.login ? { command: definition.login } : {}),
  };
  const unknown = (
    detail = 'Authentication could not be verified without a model request. You can still try this runtime.',
  ): RuntimeAuthentication => ({ ...base, status: 'unknown', detail });
  const missing = (detail: string): RuntimeAuthentication => ({
    ...base,
    status: 'missing',
    detail,
  });
  if (!definition)
    return { ...base, status: 'authenticated', detail: 'Demo does not require authentication.' };
  if (runtime === 'kiro-cli' || runtime === 'grok') {
    const key = runtime === 'kiro-cli' ? 'KIRO_API_KEY' : 'XAI_API_KEY';
    return process.env[key]?.trim()
      ? unknown(`${key} is configured; the CLI will verify it when work starts.`)
      : missing(`${key} is missing from the daemon environment.`);
  }
  if (['pi', 'oh-my-pi', 'hermes'].includes(runtime)) {
    const provider =
      runtime === 'hermes'
        ? model.includes(':')
          ? model.split(':')[0]
          : process.env.HERMES_INFERENCE_PROVIDER || 'openrouter'
        : model.includes('/')
          ? model.split('/')[0]
          : '';
    const keys = providerKeys[provider];
    if (process.env.OPENAI_BASE_URL && provider.startsWith('openai'))
      return unknown('Custom endpoint authentication will be checked by the runtime.');
    if (keys && !keys.some((key) => process.env[key]?.trim()))
      return missing(
        `The selected ${provider} provider needs ${keys.join(' or ')} in the daemon environment.`,
      );
    return unknown(
      keys
        ? 'Provider authentication is configured; it has not been verified with a model request.'
        : undefined,
    );
  }
  const executable = await findRuntimeExecutable(definition.command);
  if (!executable) return unknown('Install the runtime before checking authentication.');
  try {
    if (runtime === 'codex') {
      const account = await readCodexAccount(executable, signal);
      if (
        account.account &&
        typeof account.account === 'object' &&
        !Array.isArray(account.account) &&
        'type' in account.account &&
        typeof account.account.type === 'string'
      )
        return {
          ...base,
          status: 'authenticated',
          detail: 'Codex reports an authenticated account.',
        };
      return account.account === null && account.requiresOpenaiAuth
        ? missing('Codex requires sign-in.')
        : unknown('Codex does not require OpenAI sign-in for this configuration.');
    }
    if (runtime === 'claude-code') {
      const result = await runMaintenanceCommand(
        { file: executable, args: ['--setting-sources', '', 'auth', 'status', '--json'] },
        { signal },
      );
      const status = JSON.parse(result.stdout) as { loggedIn?: unknown };
      if (status.loggedIn === true && result.code === 0)
        return {
          ...base,
          status: 'authenticated',
          detail: 'Claude reports native authentication.',
        };
      const alternate = [
        'ANTHROPIC_API_KEY',
        'ANTHROPIC_AUTH_TOKEN',
        'ANTHROPIC_BASE_URL',
        'CLAUDE_CODE_USE_BEDROCK',
        'CLAUDE_CODE_USE_VERTEX',
        'CLAUDE_CODE_USE_FOUNDRY',
      ].some((key) => process.env[key]);
      if (status.loggedIn === false && !alternate)
        return missing('Claude requires native sign-in or supported provider authentication.');
    }
    if (runtime === 'cursor-agent') {
      const result = await runMaintenanceCommand(
        { file: executable, args: ['status'] },
        { signal },
      );
      const text = `${result.stdout}\n${result.stderr}`.toLowerCase();
      if (
        /not authenticated|not logged in|logged out/.test(text) &&
        !process.env.CURSOR_API_KEY &&
        !process.env.CURSOR_AUTH_TOKEN
      )
        return missing('Cursor requires sign-in.');
      if (
        result.code === 0 &&
        /authenticated|logged in|login successful/.test(text) &&
        !/not authenticated|not logged in/.test(text)
      )
        return {
          ...base,
          status: 'authenticated',
          detail: 'Cursor reports native authentication.',
        };
    }
  } catch {
    /* Probe failures are unknown, never proof of missing credentials. */
  }
  return unknown();
};

const providerKeys: Record<string, string[]> = {
  openai: ['OPENAI_API_KEY'],
  'openai-api': ['OPENAI_API_KEY'],
  anthropic: ['ANTHROPIC_API_KEY'],
  google: ['GOOGLE_API_KEY', 'GEMINI_API_KEY'],
  gemini: ['GOOGLE_API_KEY', 'GEMINI_API_KEY'],
  openrouter: ['OPENROUTER_API_KEY'],
  xai: ['XAI_API_KEY'],
};
