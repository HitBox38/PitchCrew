import type { ChatContext, RunContext } from '@pitchcrew/core';
import { homedir } from 'node:os';
import { delimiter, join } from 'node:path';
export const runtimeEnvironment = (
  context: RunContext | ChatContext,
  env: Record<string, string | undefined> = {},
) => {
  return cliEnvironment({ ...context.mcp.env, ...env });
};
export const cliEnvironment = (env: Record<string, string | undefined> = {}) => {
  const environment: NodeJS.ProcessEnv = {
    ...Object.fromEntries(
      Object.entries(process.env).filter(([key]) => !key.startsWith('PITCHCREW_GOOGLE_')),
    ),
    ...env,
  };
  // An installer can add a CLI after startup without updating the daemon's inherited PATH.
  // Append native install folders on every invocation, preserving explicit PATH precedence.
  const pathKey =
    process.platform === 'win32'
      ? (Object.keys(environment).findLast((key) => key.toUpperCase() === 'PATH') ?? 'PATH')
      : 'PATH';
  if (process.platform === 'win32')
    for (const key of Object.keys(environment))
      if (key !== pathKey && key.toUpperCase() === 'PATH') delete environment[key];
  environment[pathKey] = [
    ...new Set([
      ...(environment[pathKey]?.split(delimiter) ?? []),
      join(homedir(), '.local', 'bin'),
      join(homedir(), '.grok', 'bin'),
      join(homedir(), '.opencode', 'bin'),
    ]),
  ].join(delimiter);
  return environment;
};

// Drafting, research and high-effort reasoning need the same budget as browser work.
export const runtimeTimeLimit = 30 * 60 * 1000;
