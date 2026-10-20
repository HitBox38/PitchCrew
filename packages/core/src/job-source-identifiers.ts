/** Public, unauthenticated ATS providers available as saved board sources. */
export const jobProviders = ['greenhouse', 'ashby', 'lever', 'comeet', 'workable'] as const;
export type JobProvider = (typeof jobProviders)[number];
export const jobProviderLabels: Record<JobProvider, string> = {
  greenhouse: 'Greenhouse',
  ashby: 'Ashby',
  lever: 'Lever',
  comeet: 'Comeet',
  workable: 'Workable',
};
/** Letters, digits, hyphens and underscores only: no dots, slashes, encodings or queries. */
export const jobBoardSlugPattern = /^[A-Za-z0-9][A-Za-z0-9_-]{0,79}$/;
/**
 * Ashby board names can hold dots and single inner spaces (`example.io`, `Northwind Labs`):
 * parts of letters, digits, hyphens and underscores joined by one dot or one space. No leading,
 * trailing or repeated dots or spaces, so no `.`/`..` segment; slashes, `?`, `#` and `%` never match.
 */
export const ashbyBoardPattern = /^(?=.{1,80}$)[A-Za-z0-9][A-Za-z0-9_-]*(?:[. ][A-Za-z0-9_-]+)*$/;
/**
 * A Comeet company UID, such as `A1.B2C`: two short groups of letters or digits joined by one
 * dot. The dot is never first or last, so it cannot form a `.` or `..` path segment.
 */
export const comeetCompanyUidPattern = /^[A-Za-z0-9]{1,8}\.[A-Za-z0-9]{1,8}$/;
/** A Comeet careers token. It is public, but stays out of agent-visible text and logs. */
export const comeetTokenPattern = /^[A-Za-z0-9_-]{8,128}$/;
/**
 * The saved identifier (`slug`) each provider uses: a board or account name, or the company UID
 * for Comeet. Card discovery provenance stores this value; the Comeet token is never stored there.
 */
export const jobSourceSlugPatterns: Record<JobProvider, RegExp> = {
  greenhouse: jobBoardSlugPattern,
  ashby: ashbyBoardPattern,
  lever: jobBoardSlugPattern,
  comeet: comeetCompanyUidPattern,
  workable: jobBoardSlugPattern,
};
/** Providers whose endpoint also needs a public careers token. */
export const jobProviderNeedsToken = (provider: JobProvider): boolean => provider === 'comeet';
export const maxJobSources = 25;
export const maxNewLeadsPerScan = 50;
