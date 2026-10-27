import { z } from 'zod';
export interface ImportedCookie {
  url: string;
  domain?: string;
  path: string;
  name: string;
  value: string;
  secure: boolean;
  httpOnly: boolean;
  expirationDate?: number;
  sameSite: 'no_restriction' | 'lax' | 'strict' | 'unspecified';
}
const cookieSchema = z.object({
  domain: z.string().min(1).max(255),
  path: z.string().max(2048).default('/'),
  name: z.string().min(1).max(1024),
  value: z.string().max(4096),
  secure: z.boolean().default(false),
  httpOnly: z.boolean().default(false),
  hostOnly: z.boolean().optional(),
  expirationDate: z.number().finite().optional(),
  expires: z.number().finite().optional(),
  sameSite: z.string().optional(),
  partitionKey: z.unknown().optional(),
  partitioned: z.boolean().optional(),
});
export const parseCookieExport = (source: string) => {
  if (Buffer.byteLength(source) > 1_000_000)
    throw new Error('Cookie exports must be at most 1 MB.');
  let rows: unknown[];
  if (source.trimStart().startsWith('[') || source.trimStart().startsWith('{')) {
    const parsed = JSON.parse(source) as unknown;
    rows = Array.isArray(parsed)
      ? parsed
      : z.object({ cookies: z.array(z.unknown()) }).parse(parsed).cookies;
  } else
    rows = source
      .split(/\r?\n/)
      .filter((line) => line.trim() && (!line.startsWith('#') || line.startsWith('#HttpOnly_')))
      .map((line) => {
        const [domain, subdomains, path, secure, expiry, name, ...value] = line
          .replace(/^#HttpOnly_/, '')
          .split('\t');
        if (
          !name ||
          value.length !== 1 ||
          !['TRUE', 'FALSE'].includes(subdomains) ||
          !['TRUE', 'FALSE'].includes(secure)
        )
          throw new Error('Invalid Netscape cookie export.');
        return {
          domain,
          path,
          secure: secure === 'TRUE',
          httpOnly: line.startsWith('#HttpOnly_'),
          expirationDate: Number(expiry),
          name,
          value: value[0],
          hostOnly: subdomains === 'FALSE',
        };
      });
  if (!rows.length || rows.length > 1000) throw new Error('Import between 1 and 1,000 cookies.');
  let skipped = 0;
  const cookies: ImportedCookie[] = [];
  const seen = new Set<string>();
  for (const raw of rows) {
    const cookie = cookieSchema.parse(raw);
    if (cookie.partitionKey || cookie.partitioned) {
      skipped++;
      continue;
    }
    const hostname = cookie.domain.replace(/^\./, '');
    if (
      !/^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,63}$/i.test(hostname) ||
      [...(cookie.name + cookie.value + cookie.path)].some(
        (character) => character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127,
      ) ||
      !cookie.path.startsWith('/')
    )
      throw new Error('Cookie domains and fields must be valid public website addresses.');
    if (cookie.name.length + cookie.value.length > 4096)
      throw new Error('A cookie exceeds the browser size limit.');
    const expirationDate = cookie.expirationDate ?? cookie.expires;
    if (expirationDate !== undefined && expirationDate > 0 && expirationDate <= Date.now() / 1000) {
      skipped++;
      continue;
    }
    const sameSite: ImportedCookie['sameSite'] =
      (
        {
          none: 'no_restriction',
          no_restriction: 'no_restriction',
          lax: 'lax',
          strict: 'strict',
          unspecified: 'unspecified',
        } as const
      )[cookie.sameSite?.toLowerCase() as 'none'] ?? 'unspecified';
    if (sameSite === 'no_restriction' && !cookie.secure)
      throw new Error('SameSite=None cookies require HTTPS.');
    if (
      (cookie.name.startsWith('__Secure-') && !cookie.secure) ||
      (cookie.name.startsWith('__Host-') &&
        (!cookie.secure || cookie.path !== '/' || cookie.domain.startsWith('.')))
    )
      throw new Error('Cookie security prefixes must match their scope.');
    const key = `${cookie.domain}\n${cookie.path}\n${cookie.name}`;
    if (seen.has(key)) throw new Error('The export contains duplicate cookies.');
    seen.add(key);
    cookies.push({
      url: `${cookie.secure ? 'https' : 'http'}://${hostname}${cookie.path}`,
      ...(cookie.hostOnly || cookie.name.startsWith('__Host-') ? {} : { domain: cookie.domain }),
      path: cookie.path,
      name: cookie.name,
      value: cookie.value,
      secure: cookie.secure,
      httpOnly: cookie.httpOnly,
      sameSite,
      ...(expirationDate !== undefined && expirationDate > 0 ? { expirationDate } : {}),
    });
  }
  if (!cookies.length) throw new Error('The export contains no supported, unexpired cookies.');
  return {
    cookies,
    skipped,
    domains: [...new Set(cookies.map((cookie) => new URL(cookie.url).hostname))].sort(),
  };
};
