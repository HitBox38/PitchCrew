import { z } from 'zod';
import { commitPattern } from './build.ts';

const apiRoot = 'https://api.github.com/repos/HitBox38/PitchCrew';
const releaseSchema = z.object({
  tag_name: z.string().regex(/^build-[a-f0-9]{40}$/),
  draft: z.literal(false),
  prerelease: z.literal(false),
});
const comparisonSchema = z.object({
  status: z.enum(['ahead', 'behind', 'identical', 'diverged']),
});

export async function githubJson(path: string, fetcher: typeof fetch, signal: AbortSignal) {
  const response = await fetcher(`${apiRoot}${path}`, {
    signal,
    redirect: 'error',
    headers: {
      Accept: 'application/vnd.github+json',
      'User-Agent': 'Pitchcrew-update-check',
      'X-GitHub-Api-Version': '2022-11-28',
    },
  });
  if (!response.ok) {
    await response.body?.cancel();
    throw new Error('GitHub release check failed.');
  }
  const reader = response.body?.getReader();
  if (!reader) throw new Error('Empty GitHub response.');
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 256_000) throw new Error('GitHub response exceeds the update check limit.');
      chunks.push(value);
    }
    return JSON.parse(Buffer.concat(chunks).toString('utf8')) as unknown;
  } finally {
    await reader.cancel().catch(() => {});
  }
}

export async function checkGitHubRelease(
  commit: string | null,
  fetcher: typeof fetch,
  signal: AbortSignal,
) {
  const release = releaseSchema.parse(await githubJson('/releases/latest', fetcher, signal));
  const latest = {
    commit: release.tag_name.slice(6),
    url: `https://github.com/HitBox38/PitchCrew/releases/tag/${release.tag_name}`,
  };
  if (!commit || !commitPattern.test(commit)) return { latest, status: 'unknown' as const };
  if (commit === latest.commit) return { latest, status: 'current' as const };
  // Page two retains the comparison summary but omits potentially large file diffs.
  let comparison: z.infer<typeof comparisonSchema>;
  try {
    comparison = comparisonSchema.parse(
      await githubJson(`/compare/${commit}...${latest.commit}?per_page=1&page=2`, fetcher, signal),
    );
  } catch {
    return { latest, status: 'unknown' as const };
  }
  const status =
    comparison.status === 'ahead'
      ? ('available' as const)
      : comparison.status === 'diverged'
        ? ('unknown' as const)
        : ('current' as const);
  return { latest, status };
}
