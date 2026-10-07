import type { ChatContext, RunContext } from '@pitchcrew/core';

// Drafting, research and high-effort reasoning need the same budget as browser work.
export const runtimeTimeLimit = 30 * 60 * 1000;
export function runtimeEnvironment(
  context: RunContext | ChatContext,
  env: Record<string, string | undefined> = {},
) {
  return cliEnvironment({ ...context.mcp.env, ...env });
}
export function cliEnvironment(env: Record<string, string | undefined> = {}) {
  return {
    ...Object.fromEntries(
      Object.entries(process.env).filter(([key]) => !key.startsWith('PITCHCREW_GOOGLE_')),
    ),
    ...env,
  };
}
