import type { ConnectorStatus } from '@pitchcrew/core';
import { googleScopes } from './helpers.ts';
import type { ConnectorManagerContext } from './types.ts';

export function status(this: ConnectorManagerContext): ConnectorStatus[] {
  return [
    {
      id: 'github',
      connected: !!this.store.github,
      account: this.store.github?.account ?? '',
      services: this.store.github ? ['github'] : [],
      configured: true,
      pending: this.githubConnecting,
      error: this.errors.github,
      connectionMethod: this.store.github
        ? 'mode' in this.store.github
          ? 'cli'
          : 'token'
        : undefined,
      githubCliState: this.githubCliState,
    },
    {
      id: 'google',
      connected: !!this.store.google,
      account: this.store.google?.account ?? '',
      services: Object.entries(googleScopes)
        .filter(([, scope]) => this.store.google?.scopes.includes(scope))
        .map(([name]) => name),
      configured: !!process.env.PITCHCREW_GOOGLE_CLIENT_ID,
      pending: !!this.pending || this.googleStarting,
      error: this.errors.google,
    },
  ];
}
