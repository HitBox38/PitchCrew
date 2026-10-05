import {
  comeetTokenPattern,
  jobSourceSlugPatterns,
  type JobPosting,
  type JobProvider,
} from '@pitchcrew/core';
import { cleanText, htmlToText } from './html.ts';

/**
 * Fixed official endpoints. Only the validated slug (and, for Comeet, the validated token, appended
 * as the last query parameter) varies; no caller-supplied URL is fetched.
 */
const endpoints: Record<
  JobProvider,
  { origin: string; path: (slug: string) => string; query: string; token?: string }
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
  comeet: {
    origin: 'https://www.comeet.co',
    path: (uid) => `/careers-api/2.0/company/${uid}/positions`,
    query: '?details=true',
    token: 'token',
  },
  workable: {
    origin: 'https://apply.workable.com',
    path: (account) => `/api/v1/widget/accounts/${account}`,
    query: '?details=true',
  },
};
const hosted: Record<Exclude<JobProvider, 'comeet'>, (slug: string, id: string) => string> = {
  greenhouse: (slug, id) => `https://job-boards.greenhouse.io/${slug}/jobs/${id}`,
  ashby: (slug, id) => `https://jobs.ashbyhq.com/${slug}/${id}`,
  lever: (slug, id) => `https://jobs.lever.co/${slug}/${id}`,
  workable: (slug, id) => `https://apply.workable.com/${slug}/j/${id}/`,
};
export const maxPostingsPerSource = 2000;
/** Status messages that explain provider-specific failures better than the generic ones. */
export const providerStatusMessages: Partial<Record<JobProvider, Record<number, string>>> = {
  comeet: {
    400: 'Comeet did not accept the company UID and token. Check both on the careers page.',
    401: 'Comeet did not accept the company UID and token. Check both on the careers page.',
    403: 'Comeet did not accept the company UID and token. Check both on the careers page.',
    404: 'Comeet company not found. Check the company UID and token.',
  },
  workable: { 404: 'Workable account not found. Check the account name.' },
};

/** Board-name callers that predate per-provider patterns get the shared board-name rule. */
export function assertSlug(slug: string, provider: JobProvider = 'greenhouse'): string {
  if (!jobSourceSlugPatterns[provider]?.test(slug)) throw new Error('Invalid job board name.');
  return slug;
}
export function sourceEndpoint(provider: JobProvider, slug: string, token?: string): URL {
  const template = endpoints[provider];
  if (!template) throw new Error('Unsupported job board provider.');
  const path = template.path(encodeURIComponent(assertSlug(slug, provider)));
  let query = template.query;
  if (template.token) {
    if (!token || !comeetTokenPattern.test(token)) throw new Error('Invalid careers token.');
    query += `&${template.token}=${encodeURIComponent(token)}`;
  } else if (token !== undefined) throw new Error('This job board does not use a token.');
  const url = new URL(`${template.origin}${path}${query}`);
  // Defense in depth: the parsed URL must still be exactly the fixed template.
  if (url.origin !== template.origin || url.pathname !== path || url.search !== query)
    throw new Error('Invalid job board name.');
  return url;
}
/** Hide a careers token in text that may reach logs, scan summaries or agents. */
export function redactToken(message: string, token?: string): string {
  return token ? message.split(token).join('[token]') : message;
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

/**
 * Comeet and Workable list one position published to several offices once per office. Keep one
 * posting per key, listing every office so location filters still see each one.
 */
interface Copy {
  /** Postings with the same key are one position. */
  key: string;
  /** Preferred as the merged posting, for example Comeet's base UID. */
  primary: boolean;
  posting: JobPosting;
}
function mergeCopies(copies: Copy[]): JobPosting[] {
  const groups = new Map<string, Copy[]>();
  for (const copy of copies) groups.set(copy.key, [...(groups.get(copy.key) ?? []), copy]);
  return [...groups.values()].map((group) => {
    const first = (group.find((item) => item.primary) ?? group[0]!).posting;
    const offices = new Map<string, string>();
    for (const { posting } of [{ posting: first }, ...group])
      for (const office of posting.location.split('; '))
        if (office && !offices.has(office.toLowerCase())) offices.set(office.toLowerCase(), office);
    return {
      ...first,
      location: [...offices.values()].join('; ').slice(0, 120),
      remote: group.some((item) => item.posting.remote),
    };
  });
}
const slugify = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
function comeetSections(value: unknown): string {
  return list(value)
    .map((item, index) => ({ section: record(item), index }))
    .sort((a, b) => {
      const order = (item: Json) => (typeof item.order === 'number' ? item.order : Infinity);
      return order(a.section) - order(b.section) || a.index - b.index;
    })
    .map(({ section }) => {
      const name = text(section.name, 200).replace(/</g, '&lt;');
      const body = typeof section.value === 'string' ? section.value : '';
      return `${name ? `<h3>${name}</h3>` : ''}${body}`;
    })
    .join('\n');
}
function comeet(uid: string, body: unknown): JobPosting[] {
  const postings = list(body).flatMap((value): Copy[] => {
    const job = record(value);
    if (job.is_internal === true) return [];
    const jobId = identifier(job.uid);
    const title = text(job.name, 160);
    if (!jobId || !title) return [];
    const place = record(job.location);
    const location =
      text(place.name, 120) ||
      [text(place.city, 60), text(place.state, 60), text(place.country, 60)]
        .filter(Boolean)
        .join(', ');
    const workplace = text(job.workplace_type, 40).toLowerCase();
    const fallback = `https://www.comeet.com/jobs/${slugify(text(job.company_name, 120)) || 'company'}/${uid}/${slugify(title) || 'position'}/${jobId}`;
    // A posting link never carries the careers token; skip any field that looks like an API link.
    const links = [job.url_comeet_hosted_page, job.url_active_page, job.url_detected_page].filter(
      (link) => typeof link === 'string' && !/[?&]token=|careers-api/i.test(link),
    );
    const url = links.map((link) => webUrl(link, '')).find(Boolean) ?? fallback;
    return [
      {
        key: jobId.split('-')[0]!,
        primary: !jobId.includes('-'),
        posting: {
          provider: 'comeet',
          jobId,
          title,
          location: location.slice(0, 120),
          remote: place.is_remote === true || workplace === 'remote' || remoteText(location),
          url,
          description: htmlToText(comeetSections(job.details)),
          salary: '',
          // Comeet publishes no posting date; the last update time is the closest it offers.
          postedAt: isoDate(job.time_updated),
        },
      },
    ];
  });
  return mergeCopies(postings);
}
function workableLocations(job: Json): string[] {
  const top = [text(job.city, 60), text(job.state, 60), text(job.country, 60)]
    .filter(Boolean)
    .join(', ');
  const extra = list(job.locations).flatMap((item) => {
    const place = record(item);
    if (place.hidden === true) return [];
    const name = [text(place.city, 60), text(place.region, 60), text(place.country, 60)]
      .filter(Boolean)
      .join(', ');
    return name ? [name] : [];
  });
  return [top, ...extra].filter(Boolean);
}
function workable(account: string, body: unknown): JobPosting[] {
  const postings = list(record(body).jobs).flatMap((value): Copy[] => {
    const job = record(value);
    const jobId = identifier(job.shortcode);
    const title = text(job.title, 160);
    if (!jobId || !title) return [];
    const location = workableLocations(job).join('; ');
    const workplace = text(job.workplace, 40).toLowerCase();
    const html = [
      job.description,
      typeof job.requirements === 'string' ? `<h3>Requirements</h3>${job.requirements}` : '',
      typeof job.benefits === 'string' ? `<h3>Benefits</h3>${job.benefits}` : '',
    ]
      .map((item) => (typeof item === 'string' ? item : ''))
      .join('\n');
    const url = [job.url, job.shortlink].map((link) => webUrl(link, '')).find(Boolean);
    return [
      {
        key: jobId,
        primary: true,
        posting: {
          provider: 'workable',
          jobId,
          title,
          location: location.slice(0, 120),
          remote: job.telecommuting === true || workplace === 'remote' || remoteText(location),
          url: url ?? hosted.workable(account, jobId),
          description: htmlToText(html),
          salary: '',
          postedAt: isoDate(job.published_on) ?? isoDate(job.created_at),
        },
      },
    ];
  });
  return mergeCopies(postings);
}

/** Providers whose response is a bare array of postings rather than `{ jobs: [...] }`. */
const arrayResponse = (provider: JobProvider) => provider === 'lever' || provider === 'comeet';
export function parsePostings(provider: JobProvider, slug: string, body: unknown): JobPosting[] {
  if (arrayResponse(provider) ? !Array.isArray(body) : !Array.isArray(record(body).jobs))
    throw new Error('The job board returned an unexpected response.');
  return { greenhouse, ashby, lever, comeet, workable }[provider](slug, body);
}
export function truncatedResponse(provider: JobProvider, body: unknown): boolean {
  const items = arrayResponse(provider) ? body : record(body).jobs;
  return Array.isArray(items) && items.length > maxPostingsPerSource;
}
