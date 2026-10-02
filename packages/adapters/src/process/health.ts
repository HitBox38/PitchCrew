import type { RuntimeHealth, RuntimeId } from '@pitchcrew/core';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

export const exec = promisify(execFile);
export function requireCliVersion(
  health: RuntimeHealth,
  minimum: readonly number[],
  command: string,
): RuntimeHealth {
  if (!health.available) return health;
  const match = health.version.match(/(?:^|[^\d])(\d+)\.(\d+)\.(\d+)\b/);
  const version = match?.slice(1).map(Number);
  const difference = version?.map((part, i) => part - minimum[i]).find((part) => part !== 0);
  if (version && (difference === undefined || difference > 0)) return health;
  return {
    ...health,
    available: false,
    detail: `${command} ${minimum.join('.')} or newer is required for scoped MCP runs. Upgrade ${command} and retry.`,
  };
}
export async function detectCli(id: RuntimeId, command: string): Promise<RuntimeHealth> {
  try {
    const { stdout } = await exec(command, ['--version'], { timeout: 5000, windowsHide: true });
    return {
      id,
      available: true,
      version: stdout.trim().slice(0, 100),
      detail: 'Installed. Authentication is managed by the CLI.',
    };
  } catch {
    return {
      id,
      available: false,
      version: '',
      detail: `Install ${command} and configure its native authentication to connect.`,
    };
  }
}
