import { boundedText } from './helpers.ts';
import { githubCliAccount } from './github-cli.ts';
import type { ConnectorManagerContext } from './types.ts';

/** Private transport for the bounded Profile writer; never part of connector tool discovery. */
export const githubProfileRequest = async (
  context: ConnectorManagerContext,
  path: string,
  method: 'GET' | 'PUT' | 'DELETE',
  signal: AbortSignal,
  body?: Record<string, unknown>,
) => {
  const account = context.store.github;
  if (!account) throw new Error('Connect GitHub before updating a profile source.');
  signal.throwIfAborted();
  let status: number;
  let text: string;
  if ('mode' in account) {
    if ((await githubCliAccount(context, signal)) !== account.account) {
      context.githubCliState = 'account_changed';
      throw new Error('GitHub CLI account changed. Reconnect GitHub before updating Profile.');
    }
    signal.throwIfAborted();
    if (context.store.github !== account) throw new Error('GitHub connection changed.');
    const result = await context.runGithubCli(
      [
        'api',
        '--hostname',
        'github.com',
        '--method',
        method,
        '--include',
        '--header',
        'Accept: application/vnd.github+json',
        '--header',
        'X-GitHub-Api-Version: 2022-11-28',
        ...(body ? ['--input', '-'] : []),
        path,
      ],
      signal,
      body ? JSON.stringify(body) : undefined,
    );
    const header = /^HTTP\/\S+\s+(\d{3})[^\r\n]*\r?\n(?:[^\r\n]+\r?\n)*\r?\n/.exec(result.stdout);
    if (!header)
      throw new Error(
        'GitHub CLI returned no confirmed result. Inspect the source before retrying.',
      );
    status = Number(header[1]);
    text = result.stdout.slice(header[0].length);
    if (result.exitCode !== 0 && status >= 200 && status < 300)
      throw new Error(
        'GitHub CLI returned no confirmed result. Inspect the source before retrying.',
      );
  } else {
    let response: Response;
    try {
      response = await context.fetcher(`https://api.github.com/${path}`, {
        method,
        redirect: 'error',
        signal,
        headers: {
          authorization: `Bearer ${account.accessToken}`,
          accept: 'application/vnd.github+json',
          'X-GitHub-Api-Version': '2022-11-28',
          ...(body ? { 'content-type': 'application/json' } : {}),
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
    } catch {
      throw new Error(
        'GitHub request did not return a confirmed result. Inspect the source before retrying.',
      );
    }
    status = response.status;
    text = await boundedText(response);
  }
  signal.throwIfAborted();
  if (context.store.github !== account) throw new Error('GitHub connection changed.');
  if (status === 404 && method === 'GET') return null;
  if (status < 200 || status >= 300)
    throw new Error(
      `GitHub profile request failed (${status}). Check repository permissions and conflicts before retrying.`,
    );
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new Error('GitHub returned an invalid result. Inspect the source before retrying.');
  }
};
