import { z } from 'zod';
import { GithubCliMissingError } from './github-cli-process.ts';
import type { ConnectorManagerContext } from './types.ts';

export async function githubCliAccount(context: ConnectorManagerContext, signal: AbortSignal) {
  const result = await context.runGithubCli(
    ['api', '--hostname', 'github.com', '--method', 'GET', 'user'],
    signal,
  );
  signal.throwIfAborted();
  if (result.exitCode !== 0) {
    context.githubCliState = 'signed_out';
    throw new Error(
      'Sign in with gh auth login --hostname github.com --web, then try connecting again.',
    );
  }
  try {
    return z.object({ login: z.string().min(1).max(100) }).parse(JSON.parse(result.stdout)).login;
  } catch {
    throw new Error('GitHub CLI returned an invalid account response. Try connecting again.');
  }
}

export async function connectGithubCli(context: ConnectorManagerContext, signal: AbortSignal) {
  try {
    const version = await context.runGithubCli(['--version'], signal);
    signal.throwIfAborted();
    if (version.exitCode !== 0) throw new GithubCliMissingError();
    const account = await githubCliAccount(context, signal);
    signal.throwIfAborted();
    context.store.github = { mode: 'cli', account };
    await context.save();
    context.githubCliState = 'ready';
    context.errors.github = '';
    return context.status();
  } catch (error) {
    if (!signal.aborted) {
      if (error instanceof GithubCliMissingError) context.githubCliState = 'missing';
      context.errors.github =
        error instanceof Error ? error.message : 'Could not connect GitHub CLI.';
    }
    throw error;
  }
}

export async function githubCliRead(
  context: ConnectorManagerContext,
  url: URL,
  account: string,
  signal: AbortSignal,
) {
  if (url.origin !== 'https://api.github.com' || url.username || url.password)
    throw new Error('GitHub CLI requests must use the fixed GitHub API.');
  const current = await githubCliAccount(context, signal);
  if (current !== account) {
    context.githubCliState = 'account_changed';
    throw new Error(
      'GitHub CLI account changed. Reconnect GitHub in Settings → Accounts to use it.',
    );
  }
  signal.throwIfAborted();
  const result = await context.runGithubCli(
    [
      'api',
      '--hostname',
      'github.com',
      '--method',
      'GET',
      '--header',
      'Accept: application/vnd.github+json',
      '--header',
      'X-GitHub-Api-Version: 2022-11-28',
      url.pathname.slice(1) + url.search,
    ],
    signal,
  );
  signal.throwIfAborted();
  if (result.exitCode !== 0)
    throw new Error(
      'GitHub CLI could not read this resource. Check your login, repository access and rate limits.',
    );
  try {
    return JSON.parse(result.stdout) as unknown;
  } catch {
    throw new Error('GitHub CLI returned an invalid response. Try again.');
  }
}
