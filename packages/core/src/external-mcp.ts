export interface ExternalMcpInfo {
  enabled: boolean;
  write: boolean;
  /** Most recent successful external tool call for the current grant, since daemon startup. */
  lastRequest?: { action: string; at: string } | null;
  lastAttempt?: {
    action: string;
    at: string;
    outcome: 'succeeded' | 'read-only' | 'failed';
  } | null;
  configuration: { mcpServers: { pitchcrew: { command: string; args: string[] } } };
}
