import { maxJobLinkLength } from './job-link-recognition.ts';

/** Single-posting lookups beyond the saved-board providers. No network access. */
export const recognizePublicJobLink = (value: string) => {
  const raw = value.trim();
  if (!raw || raw.length > maxJobLinkLength || /\s/.test(raw)) return null;
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.port)
    return null;
  if (isProviderJobHost(url.hostname) || /(^|\.)linkedin\.com$/.test(url.hostname)) return null;
  if (url.hostname === 'jobs.smartrecruiters.com') {
    const match = /^\/([A-Za-z0-9][A-Za-z0-9_-]{0,79})\/([0-9]{1,20})(?:-[^/]*)?\/?$/.exec(
      url.pathname,
    );
    return match ? { kind: 'smartrecruiters' as const, company: match[1]!, id: match[2]! } : null;
  }
  // A careers index or company home page is not a single posting. Other job-looking pages
  // can be read only if the server finds one complete, unambiguous structured JobPosting.
  return /\/(?:careers?|positions|jobs?|vacancies)\/.+/i.test(url.pathname) ||
    ((/^careers\./.test(url.hostname) || url.hostname.endsWith('.recruitee.com')) &&
      /^\/o\/[^/]+\/?$/.test(url.pathname))
    ? { kind: 'page' as const }
    : null;
};

export const isProviderJobHost = (host: string) =>
  /(^|\.)(greenhouse\.io|ashbyhq\.com|lever\.co|comeet\.co|comeet\.com|workable\.com)$/.test(host);
