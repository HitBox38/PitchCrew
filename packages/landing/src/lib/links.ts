export const repository = 'https://github.com/HitBox38/PitchCrew';
export const releasesUrl = `${repository}/releases/latest`;
export const documentationUrl = `${repository}#quick-start`;

export function siteOrigin(): string | undefined {
  const configured = process.env.NEXT_PUBLIC_SITE_URL;
  if (!configured) return undefined;
  const url = new URL(configured);
  if (
    url.protocol !== 'https:' ||
    url.username ||
    url.password ||
    url.pathname !== '/' ||
    url.search ||
    url.hash
  )
    throw new Error('NEXT_PUBLIC_SITE_URL must be an HTTPS origin.');
  return url.origin;
}
