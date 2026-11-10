import type { ExternalMcpInfo } from '@pitchcrew/core';

export type ConfigurationFormat = 'json' | 'codex';

export const externalConfiguration = (
  configuration: ExternalMcpInfo['configuration'],
  format: ConfigurationFormat,
) => {
  if (format === 'json') return JSON.stringify(configuration, null, 2);
  const { command, args } = configuration.mcpServers.pitchcrew;
  return `[mcp_servers.pitchcrew]\ncommand = ${JSON.stringify(command)}\nargs = ${JSON.stringify(args)}\n`;
};
