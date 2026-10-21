import type { ExternalMcpInfo } from '@pitchcrew/core';
import { readExternalAccess } from '@pitchcrew/mcp/external/access';
import { cliEntry, type DaemonSettings } from '../background/settings.ts';

export const externalMcpConfiguration = (
  settings: DaemonSettings,
): ExternalMcpInfo['configuration'] => ({
  mcpServers: {
    pitchcrew: {
      command: process.execPath,
      args: [
        '--import',
        import.meta.resolve('tsx'),
        cliEntry,
        'mcp',
        'serve',
        '--home',
        settings.directory,
        '--port',
        String(settings.port),
      ],
    },
  },
});

export const externalMcpInfo = async (settings: DaemonSettings): Promise<ExternalMcpInfo> => {
  const access = await readExternalAccess(settings.directory);
  return {
    enabled: !!access,
    write: access?.write ?? false,
    configuration: externalMcpConfiguration(settings),
  };
};
