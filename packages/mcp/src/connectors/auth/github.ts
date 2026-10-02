import type { ConnectorStatus } from '@pitchcrew/core';
import { z } from 'zod';
import { boundedText } from './helpers.ts';
import type { ConnectorManagerContext } from './types.ts';

export async function connectGithub(
  this: ConnectorManagerContext,
  value: unknown,
): Promise<ConnectorStatus[]> {
  const { token } = z
    .object({ token: z.string().trim().min(1).max(1000) })
    .strict()
    .parse(value);
  if (this.githubConnecting) throw new Error('GitHub connection is already in progress.');
  if (this.store.github) throw new Error('Disconnect GitHub before connecting another account.');
  this.githubConnecting = true;
  const lifetime = this.lifetimes.github.signal;
  try {
    const response = await this.fetch(
      'https://api.github.com/user',
      {
        headers: {
          authorization: `Bearer ${token}`,
          accept: 'application/vnd.github+json',
          'X-GitHub-Api-Version': '2022-11-28',
        },
      },
      lifetime,
    );
    const user = z
      .object({ login: z.string().min(1) })
      .parse(JSON.parse(await boundedText(response)));
    lifetime.throwIfAborted();
    this.store.github = { account: user.login, accessToken: token };
    await this.save();
    this.errors.github = '';
    return this.status();
  } finally {
    this.githubConnecting = false;
  }
}
