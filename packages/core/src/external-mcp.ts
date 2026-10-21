export interface ExternalMcpInfo {
  enabled: boolean;
  write: boolean;
  configuration: { mcpServers: { pitchcrew: { command: string; args: string[] } } };
}
