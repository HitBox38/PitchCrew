import { jobBoardSlugPattern, type JobPosting, type JobProvider } from '@pitchcrew/core';
import { cleanText, htmlToText } from './html.ts';

/** Fixed official endpoints. Only the validated slug varies; no caller-supplied URL is fetched. */
const endpoints: Record<
  JobProvider,
  { origin: string; path: (slug: string) => string; query: string }
> = {
  greenhouse: {
    origin: 'https://boards-api.greenhouse.io',
    path: (slug) => `/v1/boards/${slug}/jobs`,
    query: '?content=true',
  },
  ashby: {
    origin: 'https://api.ashbyhq.com',
    path: (slug) => `/posting-api/job-board/${slug}`,
    query: '?includeCompensation=true',
  },
  lever: {
    origin: 'https://api.lever.co',
    path: (slug) => `/v0/postings/${slug}`,
    query: '?mode=json',
  },
};
const hosted: Record<JobProvider, (slug: string, id: string) => string> = {
  greenhouse: (slug, id) => `https://job-boards.greenhouse.io/${slug}/jobs/${id}`,
  ashby: (slug, id) => `https://jobs.ashbyhq.com/${slug}/${id}`,
  lever: (slug, id) => `https://jobs.lever.co/${slug}/${id}`,
};
export const maxPostingsPerSource = 2000;

export function assertSlug(slug: string): string {
  if (!jobBoardSlugPattern.test(slug)) throw new Error('Invalid job board name.');
  return slug;
}
export function sourceEndpoint(provider: JobProvider, slug: string): URL {
  const template = endpoints[provider];
  if (!template) throw new Error('Unsupported job board provider.');
  const path = template.path(encodeURIComponent(assertSlug(slug)));
  const url = new URL(`${template.origin}${path}${template.query}`);
  // Defense in depth: the parsed URL must still be exactly the fixed template.
  if (url.origin !== template.origin || url.pathname !== path || url.search !== template.query)
    throw new Error('Invalid job board name.');
  return url;
}

type Json = Record<string, unknown>;
const record = (value: unknown): Json =>
  value && typeof value === 'object' && !Array.isArray(value) ? (value as Json) : {};
const text = (value: unknown, max = 500): string =>
  typeof value === 'string' ? value.replace(/\s+/g, ' ').trim().slice(0, max) : '';
const identifier = (value: unknown): string => {
  const raw =
    typeof value === 'number' && Number.isSafeInteger(value) ? String(value) : text(value, 200);
  return /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,199}$/.test(raw) ? raw : '';
};
function webUrl(value: unknown, fallback: string): string {
  const raw = text(value, 2000);
  try {
    const url = new URL(raw);
    if ((url.protocol === 'https:' || url.protocol === 'http:') && !url.username && !url.password)
      return url.toString();
  } catch {
    // Use the provider-hosted posting URL below.
  }
  return fallback;
}
function isoDate(value: unknown): string | null {
  const time =
    typeof value === 'number' ? value : typeof value === 'string' ? Date.parse(value) : Number.NaN;
  return Number.isFinite(time) && time > 0 ? new Date(time).toISOString() : null;
}
const remoteText = (value: string) => /\bremote\b/i.test(value);
function list(value: unknown): unknown[] {
  return Array.isArray(value) ? value.slice(0, maxPostingsPerSource) : [];
}

function greenhouse(slug: string, body: unknown): JobPosting[] {
  return list(record(body).jobs).flatMap((value) => {
    const job = record(value);
    const jobId = identifier(job.id);
    const title = text(job.title, 160);
    if (!jobId || !title) return [];
    const offices = list(job.offices).map((office) => text(record(office).name, 120));
    const location = text(record(job.location).name, 120) || offices.filter(Boolean).join('; ');
    return [
      {
        provider: 'greenhouse' as const,
        jobId,
        title,
        location: location.slice(0, 120),
        remote: remoteText(location) || offices.some(remoteText),
        url: webUrl(job.absolute_url, hosted.greenhouse(slug, jobId)),
        description: htmlToText(typeof job.content === 'string' ? job.content : ''),
        salary: '',
        postedAt: isoDate(job.first_published) ?? isoDate(job.updated_at),
      },
    ];
  });
}
function ashby(slug: string, body: unknown): JobPosting[] {
  return list(record(body).jobs).flatMap((value) => {
    const job = record(value);
    if (job.isListed === false) return [];
    const url = text(job.jobUrl, 2000);
    // Older responses omit `id`; the posting UUID is the last path segment of jobUrl.
    const jobId = identifier(job.id) || identifier(url.split(/[?#]/)[0]!.split('/').pop());
    const title = text(job.title, 160);
    if (!jobId || !title) return [];
    const secondary = list(job.secondaryLocations).map((item) => text(record(item).location, 80));
    const location = [text(job.location, 120), ...secondary].filter(Boolean).join('; ');
    const compensation = record(job.compensation);
    const plain = typeof job.descriptionPlain === 'string' ? job.descriptionPlain : '';
    return [
      {
        provider: 'ashby' as const,
        jobId,
        title,
        location: location.slice(0, 120),
        remote:
          job.isRemote === true ||
          text(job.workplaceType).toLowerCase() === 'remote' ||
          remoteText(location),
        url: webUrl(url, hosted.ashby(slug, jobId)),
        description: plain
          ? cleanText(plain)
          : htmlToText(typeof job.descriptionHtml === 'string' ? job.descriptionHtml : ''),
        salary:
          text(compensation.scrapeableCompensationSalarySummary, 100) ||
          text(compensation.compensationTierSummary, 100),
        postedAt: isoDate(job.publishedAt),
      },
    ];
  });
}
function leverSalary(value: unknown): string {
  const range = record(value);
  const min = typeof range.min === 'number' ? range.min : null;
  const max = typeof range.max === 'number' ? range.max : null;
  if (min === null && max === null) return '';
  const currency = text(range.currency, 3);
  const interval = text(range.interval, 40).replace(/-/g, ' ');
  const amount = [min, max]
    .filter((item): item is number => item !== null)
    .map((item) => item.toLocaleString('en-US'))
    .join('-');
  return [currency, amount, interval].filter(Boolean).join(' ').slice(0, 100);
}
function lever(slug: string, body: unknown): JobPosting[] {
  return list(body).flatMap((value) => {
    const job = record(value);
    const jobId = identifier(job.id);
    const title = text(job.text, 160);
    if (!jobId || !title) return [];
    const categories = record(job.categories);
    const all = list(categories.allLocations).map((item) => text(item, 80));
    const location = text(categories.location, 120) || all.filter(Boolean).join('; ');
    const sections = list(job.lists).map((item) => {
      const section = record(item);
      return `<h3>${text(section.text, 200).replace(/</g, '&lt;')}</h3><ul>${typeof section.content === 'string' ? section.content : ''}</ul>`;
    });
    const html = [job.description, ...sections, job.additional]
      .map((item) => (typeof item === 'string' ? item : ''))
      .join('\n');
    return [
      {
        provider: 'lever' as const,
        jobId,
        title,
        location: location.slice(0, 120),
        remote: text(job.workplaceType).toLowerCase() === 'remote' || remoteText(location),
        url: webUrl(job.hostedUrl, hosted.lever(slug, jobId)),
        description: htmlToText(html),
        salary: leverSalary(job.salaryRange),
        postedAt: isoDate(job.createdAt),
      },
    ];
  });
}

export function parsePostings(provider: JobProvider, slug: string, body: unknown): JobPosting[] {
  if (provider === 'lever' ? !Array.isArray(body) : !Array.isArray(record(body).jobs))
    throw new Error('The job board returned an unexpected response.');
  return { greenhouse, ashby, lever }[provider](slug, body);
}
export function truncatedResponse(provider: JobProvider, body: unknown): boolean {
  const items = provider === 'lever' ? body : record(body).jobs;
  return Array.isArray(items) && items.length > maxPostingsPerSource;
}
