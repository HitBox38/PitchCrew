import { join } from 'node:path';
import { close, disconnect, initialize, save } from './credentials.ts';
import { connectGithub } from './github.ts';
import { cancelPending, connectGoogle, googleAccessToken } from './google.ts';
import { call, fetch } from './http.ts';
import { status } from './status.ts';
import type { ConnectorManagerContext } from './types.ts';
import { createGithubCliRunner, type GithubCliRunner } from './github-cli-process.ts';
import { createGoogleCliRunner, type GoogleCliRunner } from './google-cli-process.ts';
import { connectGoogleCli } from './google-cli.ts';

export const createConnectorManagerContext = (
  directory: string,
  fetcher: typeof globalThis.fetch = globalThis.fetch,
  runGithubCli: GithubCliRunner = createGithubCliRunner(),
  runGoogleCli: GoogleCliRunner = createGoogleCliRunner(),
): ConnectorManagerContext => {
  const context: ConnectorManagerContext = {
    directory,
    fetcher,
    runGithubCli,
    runGoogleCli,
    store: { version: 1 },
    pending: undefined,
    errors: { github: '', google: '' },
    lifetimes: { github: new AbortController(), google: new AbortController() },
    refreshing: undefined,
    saving: Promise.resolve(),
    githubConnecting: false,
    googleStarting: false,
    get folder() {
      return join(context.directory, 'connectors');
    },
    get file() {
      return join(context.folder, 'credentials.json');
    },
    initialize: (...args) => initialize(context, ...args),
    status: (...args) => status(context, ...args),
    save: (...args) => save(context, ...args),
    fetch: (...args) => fetch(context, ...args),
    connectGithub: (...args) => connectGithub(context, ...args),
    connectGoogle: (...args) => connectGoogle(context, ...args),
    connectGoogleCli: () => connectGoogleCli(context),
    cancelPending: (...args) => cancelPending(context, ...args),
    disconnect: (...args) => disconnect(context, ...args),
    googleAccessToken: (...args) => googleAccessToken(context, ...args),
    call: (...args) => call(context, ...args),
    close: (...args) => close(context, ...args),
  };

  return context;
};
