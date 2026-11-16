import { z } from 'zod';
import { githubProfileRequest } from './github-profile-request.ts';
import type { ConnectorManagerContext } from './types.ts';

const sha = z.string().regex(/^[a-f0-9]{40}$/);
const hasControl = (value: string) =>
  [...value].some((character) => character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127);
const branchName = z
  .string()
  .min(1)
  .max(200)
  .refine(
    (value) =>
      !value.startsWith('-') &&
      !value.startsWith('/') &&
      !value.endsWith('/') &&
      !value.endsWith('.') &&
      !value.includes('..') &&
      !value.includes('@{') &&
      !/[\s\\~^:?*[]/.test(value) &&
      !hasControl(value) &&
      value.split('/').every((part) => part && !part.startsWith('.') && !part.endsWith('.lock')),
  );
const profileWrite = z
  .object({
    repository: z
      .string()
      .max(200)
      .regex(/^[a-zA-Z0-9_-]+\/[a-zA-Z0-9_.-]+$/)
      .refine((value) => !['.', '..'].includes(value.split('/')[1]!)),
    branch: branchName.optional(),
    path: z
      .string()
      .min(1)
      .max(500)
      .refine(
        (value) =>
          /\.(md|txt)$/i.test(value) &&
          !value.includes('\\') &&
          !hasControl(value) &&
          value
            .split('/')
            .every(
              (part) => part && part !== '.' && part !== '..' && part.toLowerCase() !== '.git',
            ),
      ),
    content: z
      .string()
      .max(50000)
      .refine((value) => !value.includes('\0'))
      .nullable(),
    expectedSha: sha.nullable(),
    message: z.string().trim().min(1).max(500),
  })
  .strict();

export const writeProfileGithub = async (
  context: ConnectorManagerContext,
  value: unknown,
  runSignal: AbortSignal,
  authorize?: () => Promise<void>,
) => {
  const input = profileWrite.parse(value);
  if (input.content === null && input.expectedSha === null)
    throw new Error('Deleting a source file requires its current revision.');
  const signal = AbortSignal.any([
    runSignal,
    context.lifetimes.github.signal,
    AbortSignal.timeout(20000),
  ]);
  const request = (
    path: string,
    method: 'GET' | 'PUT' | 'DELETE' = 'GET',
    body?: Record<string, unknown>,
  ) => githubProfileRequest(context, path, method, signal, body);
  const base = `repos/${input.repository}`;
  let branch = input.branch;
  if (!branch)
    branch = branchName.parse(
      z.object({ default_branch: branchName }).parse(await request(base)).default_branch,
    );
  const liveBranch = await request(`${base}/branches/${encodeURIComponent(branch)}`);
  if (!liveBranch)
    throw new Error('The profile source must target an existing branch, not a tag or commit.');
  z.object({ name: z.literal(branch), commit: z.object({ sha }) }).parse(liveBranch);
  const path = input.path.split('/').map(encodeURIComponent).join('/');
  const endpoint = `${base}/contents/${path}`;
  const current = await request(`${endpoint}?ref=${encodeURIComponent(branch)}`);
  const currentSha =
    current === null ? null : z.object({ type: z.literal('file'), sha }).parse(current).sha;
  if (currentSha !== input.expectedSha)
    throw new Error('The GitHub profile note changed. Refresh the source before editing it.');
  await authorize?.();
  signal.throwIfAborted();
  const result = z
    .object({
      content: z.object({ sha }).nullable(),
      commit: z.object({ sha }),
    })
    .parse(
      await request(endpoint, input.content === null ? 'DELETE' : 'PUT', {
        branch,
        message: input.message,
        ...(input.expectedSha ? { sha: input.expectedSha } : {}),
        ...(input.content === null
          ? {}
          : { content: Buffer.from(input.content, 'utf8').toString('base64') }),
      }),
    );
  if (input.content !== null && !result.content)
    throw new Error('GitHub did not confirm the saved note. Inspect the source before retrying.');
  return {
    sha: result.content?.sha ?? null,
    commit: result.commit.sha,
    branch,
    url: `https://github.com/${input.repository}/blob/${result.commit.sha}/${path}`,
  };
};
