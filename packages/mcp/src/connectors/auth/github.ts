import type { ConnectorStatus } from '@pitchcrew/core';
import { z } from 'zod';
import { boundedText } from './helpers.ts';
import type { ConnectorManagerContext } from './types.ts';
import { connectGithubCli } from './github-cli.ts';

export const connectGithub = async (
  context: ConnectorManagerContext,
  value: unknown,
): Promise<ConnectorStatus[]> => {
  const input = z
    .union([
      z.object({ token: z.string().trim().min(1).max(1000) }).strict(),
      z.object({ mode: z.literal('cli') }).strict(),
    ])
    .parse(value);
  if (context.githubConnecting) throw new Error('GitHub connection is already in progress.');
  if (context.store.github) throw new Error('Disconnect GitHub before connecting another account.');
  context.githubConnecting = true;
  const lifetime = context.lifetimes.github.signal;
  try {
    if ('mode' in input) return await connectGithubCli(context, lifetime);
    const { token } = input;
    const response = await context.fetch(
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
    context.store.github = { account: user.login, accessToken: token };
    await context.save();
    context.errors.github = '';
    return context.status();
  } finally {
    context.githubConnecting = false;
  }
};
