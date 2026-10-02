import { join } from 'node:path';
import { close, disconnect, initialize, save } from './credentials.ts';
import { connectGithub } from './github.ts';
import { cancelPending, connectGoogle, googleAccessToken } from './google.ts';
import { call, fetch } from './http.ts';
import { status } from './status.ts';
import type { ConnectorManagerContext } from './types.ts';

export function createConnectorManagerContext(
  directory: string,
  fetcher: typeof globalThis.fetch = globalThis.fetch,
): ConnectorManagerContext {
  const context: ConnectorManagerContext = {
    directory,
    fetcher,
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
    initialize: (...args) => initialize.call(context, ...args),
    status: (...args) => status.call(context, ...args),
    save: (...args) => save.call(context, ...args),
    fetch: (...args) => fetch.call(context, ...args),
    connectGithub: (...args) => connectGithub.call(context, ...args),
    connectGoogle: (...args) => connectGoogle.call(context, ...args),
    cancelPending: (...args) => cancelPending.call(context, ...args),
    disconnect: (...args) => disconnect.call(context, ...args),
    googleAccessToken: (...args) => googleAccessToken.call(context, ...args),
    call: (...args) => call.call(context, ...args),
    close: (...args) => close.call(context, ...args),
  };

  return context;
}
