import type { ConnectorStatus } from '@pitchcrew/core';
import { createConnectorManagerContext } from './auth/context.ts';
import type { ConnectorManagerContext } from './auth/types.ts';
import type { GithubCliRunner } from './auth/github-cli-process.ts';
import type { GoogleCliRunner } from './auth/google-cli-process.ts';

export { googleScopes } from './auth/helpers.ts';
export class ConnectorManager {
  private readonly context: ConnectorManagerContext;
  constructor(
    readonly directory: string,
    readonly fetcher: typeof fetch = fetch,
    runGithubCli?: GithubCliRunner,
    runGoogleCli?: GoogleCliRunner,
  ) {
    this.context = createConnectorManagerContext(directory, fetcher, runGithubCli, runGoogleCli);
  }

  initialize(): Promise<void> {
    return this.context.initialize();
  }
  status(): ConnectorStatus[] {
    return this.context.status();
  }
  connectGithub(value: unknown): Promise<ConnectorStatus[]> {
    return this.context.connectGithub(value);
  }
  connectGoogle(value: unknown): Promise<{ authorizationUrl: string }> {
    return this.context.connectGoogle(value);
  }
  connectGoogleCli(): Promise<ConnectorStatus[]> {
    return this.context.connectGoogleCli();
  }
  disconnect(provider: 'github' | 'google'): Promise<ConnectorStatus[]> {
    return this.context.disconnect(provider);
  }
  call(name: string, input: unknown, signal: AbortSignal): Promise<Record<string, unknown>> {
    return this.context.call(name, input, signal);
  }
  close(): Promise<void> {
    return this.context.close();
  }
}
