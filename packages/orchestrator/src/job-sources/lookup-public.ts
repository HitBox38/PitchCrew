import { isLikelyDuplicateApplication } from '@pitchcrew/board';
import {
  canonicalJobUrl,
  jobLinkDetails,
  jobLookupInput,
  recognizeJobLink,
  type Card,
  type JobLookupResult,
} from '@pitchcrew/core';
import { isProviderJobHost, recognizePublicJobLink } from '@pitchcrew/core/public-job-links';
import { fetchBoard } from './fetch.ts';
import { htmlToText } from './html.ts';
import { lookupDeadlineMs, lookupJobLink, type LookupDependencies } from './lookup.ts';
import { structuredJobDetails } from './page-details.ts';
import type { ReadJobPage } from './public-page.ts';

/** Fixed SmartRecruiters posting API; response URLs and references never drive requests. */
const smartRecruiters = async (
  link: { company: string; id: string },
  dependencies: LookupDependencies,
) => {
  const endpoint = new URL(
    `https://api.smartrecruiters.com/v1/companies/${link.company}/postings/${link.id}`,
  );
  const body = record(
    await dependencies.limiter.schedule(
      'smartrecruiters',
      () =>
        fetchBoard(dependencies.fetch, endpoint, {
          signal: dependencies.signal,
          maxBytes: 400_000,
        }),
      dependencies.signal,
    ),
  );
  if (String(body.id) !== link.id || body.active === false) return null;
  const sections = record(record(body.jobAd).sections);
  const location = record(body.location);
  const parsed = jobLinkDetails.safeParse({
    company: text(record(body.company).name).slice(0, 100),
    title: text(body.name).slice(0, 160),
    location: [location.city, location.region, location.country]
      .map(text)
      .filter(Boolean)
      .join(', ')
      .slice(0, 120),
    salary: '',
    description: ['companyDescription', 'jobDescription', 'qualifications', 'additionalInformation']
      .map((key) => text(record(sections[key]).text))
      .filter(Boolean)
      .join('\n\n')
      .slice(0, 20_000),
  });
  return parsed.success ? parsed.data : null;
};

/** Read-only user prefill: provider APIs first, then structured public posting pages. */
export const lookupPublicJobLink = async (
  value: unknown,
  provided: LookupDependencies & {
    readPage: ReadJobPage;
  },
): Promise<JobLookupResult> => {
  const { url } = jobLookupInput.parse(value);
  const dependencies = {
    ...provided,
    signal: AbortSignal.any([provided.signal, AbortSignal.timeout(lookupDeadlineMs)]),
  };
  const provider = await lookupJobLink({ url }, dependencies);
  if (provider.status !== 'unrecognized') return provider;
  const link = recognizePublicJobLink(url);
  if (!link) return provider;
  try {
    dependencies.signal.throwIfAborted();
    let details;
    let resolvedUrl = url.trim();
    if (link.kind === 'smartrecruiters') {
      details = await smartRecruiters(link, dependencies);
    } else {
      const page = await dependencies.limiter.schedule(
        'public-page',
        () => dependencies.readPage(url, dependencies.signal),
        dependencies.signal,
      );
      dependencies.signal.throwIfAborted();
      const resolved = recognizeJobLink(page.url);
      if (resolved.recognized) return lookupJobLink({ url: page.url }, dependencies);
      if (isProviderJobHost(new URL(page.url).hostname)) return unsupported(resolved.reason);
      resolvedUrl = page.url;
      details = structuredJobDetails(page.html);
    }
    dependencies.signal.throwIfAborted();
    if (!details)
      return unsupported(
        'Could not fill complete job details from this link. Ask Scout to read it, or paste the posting text.',
      );
    const prefill = {
      ...details,
      url: resolvedUrl,
      jobIdentifier: link.kind === 'smartrecruiters' ? link.id : '',
    };
    const duplicates = dependencies.board
      .list<Card>('card')
      .filter(
        (card) =>
          canonicalJobUrl(card.url) === canonicalJobUrl(url) ||
          isLikelyDuplicateApplication(card, prefill),
      );
    return {
      status: 'found',
      prefill,
      duplicates: duplicates.map(({ id, company, title, state }) => ({
        id,
        company,
        title,
        state,
      })),
    };
  } catch {
    if (dependencies.signal.aborted)
      return { status: 'failed', reason: 'The lookup was cancelled.' };
    return unsupported(
      'Could not read this public posting automatically. Ask Scout to read it, or paste the posting text.',
    );
  }
};

const record = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
const text = (value: unknown) => (typeof value === 'string' ? htmlToText(value) : '');
const unsupported = (reason: string): JobLookupResult => ({ status: 'unrecognized', reason });
