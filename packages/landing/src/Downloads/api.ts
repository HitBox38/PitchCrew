import { parseRelease } from './helpers';
import type { Release } from './types';

export async function latestRelease(): Promise<Release> {
  try {
    const response = await fetch(
      'https://api.github.com/repos/HitBox38/PitchCrew/releases/latest',
      {
        headers: { Accept: 'application/vnd.github+json' },
        next: { revalidate: 3600 },
        signal: AbortSignal.timeout(5000),
      },
    );
    if (response.ok) return parseRelease(await response.json());
  } catch {
    /* The page and Releases fallback remain usable offline. */
  }
  return parseRelease(null);
}
