import { sourceArguments } from '../process.ts';
import type { ExternalMcpInfo } from '@pitchcrew/core';
import { readExternalAccess } from '@pitchcrew/mcp/external/access';
import { cliEntry, type DaemonSettings } from '../background/settings.ts';

export const externalMcpConfiguration = (
  settings: DaemonSettings,
): ExternalMcpInfo['configuration'] => ({
  mcpServers: {
    pitchcrew: {
      command: process.execPath,
      args: sourceArguments(
        cliEntry,
        'mcp',
        'serve',
        '--home',
        settings.directory,
        '--port',
        String(settings.port),
      ),
    },
  },
});

export const externalMcpInfo = async (
  settings: DaemonSettings,
  lastRequest?: { token: string; action: string; at: string },
  lastAttempt?: { token: string } & NonNullable<ExternalMcpInfo['lastAttempt']>,
): Promise<ExternalMcpInfo> => {
  const access = await readExternalAccess(settings.directory);
  return {
    enabled: !!access,
    write: access?.write ?? false,
    lastRequest:
      access && lastRequest?.token === access.token
        ? { action: lastRequest.action, at: lastRequest.at }
        : null,
    lastAttempt:
      access && lastAttempt?.token === access.token
        ? { action: lastAttempt.action, at: lastAttempt.at, outcome: lastAttempt.outcome }
        : null,
    configuration: externalMcpConfiguration(settings),
  };
};
