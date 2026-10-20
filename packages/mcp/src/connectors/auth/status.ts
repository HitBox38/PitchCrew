import type { ConnectorStatus } from '@pitchcrew/core';
import { googleScopes } from './helpers.ts';
import { googleCliServices } from './google-cli.ts';
import type { ConnectorManagerContext } from './types.ts';

export const status = (context: ConnectorManagerContext): ConnectorStatus[] => {
  return [
    {
      id: 'github',
      connected: !!context.store.github,
      account: context.store.github?.account ?? '',
      services: context.store.github ? ['github'] : [],
      configured: true,
      pending: context.githubConnecting,
      error: context.errors.github,
      connectionMethod: context.store.github
        ? 'mode' in context.store.github
          ? 'cli'
          : 'token'
        : undefined,
      githubCliState: context.githubCliState,
    },
    {
      id: 'google',
      connected: !!context.store.google,
      account: context.store.google?.account ?? '',
      services:
        context.store.google && 'mode' in context.store.google
          ? googleCliServices(context.store.google.scopes)
          : Object.entries(googleScopes)
              .filter(([, scope]) => context.store.google?.scopes.includes(scope))
              .map(([name]) => name),
      configured: !!process.env.PITCHCREW_GOOGLE_CLIENT_ID,
      pending: !!context.pending || context.googleStarting,
      error: context.errors.google,
      connectionMethod: context.store.google
        ? 'mode' in context.store.google
          ? 'cli'
          : 'oauth'
        : undefined,
      googleCliState: context.googleCliState,
    },
  ];
};
