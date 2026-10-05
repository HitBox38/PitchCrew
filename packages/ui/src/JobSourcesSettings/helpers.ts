import type { JobScanSummary, JobSource, JobSourceInput } from '@pitchcrew/core';
import { tokenProviders } from './constants.ts';
import type { BoardLink, SourceDraft } from './types.ts';

const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? '' : 's'}`;

/** Split comma or line separated keywords, dropping blanks and repeats. */
export function keywordList(value: string): string[] {
  return [
    ...new Set(
      value
        .split(/[,\n]/)
        .map((item) => item.trim())
        .filter(Boolean),
    ),
  ].slice(0, 20);
}
/** Read the provider and identifiers from a public board, careers or API link. */
function linkParts(url: URL): BoardLink | null {
  const host = url.hostname.toLowerCase();
  const parts = url.pathname.split('/').filter(Boolean);
  if (/^(?:job-)?boards\.greenhouse\.io$/.test(host))
    return { provider: 'greenhouse', slug: parts[0] };
  if (host === 'boards-api.greenhouse.io') return { provider: 'greenhouse', slug: parts[2] };
  if (host === 'jobs.ashbyhq.com') return { provider: 'ashby', slug: parts[0] };
  if (host === 'jobs.lever.co') return { provider: 'lever', slug: parts[0] };
  if (host === 'apply.workable.com')
    return {
      provider: 'workable',
      slug: parts[0] === 'api' ? parts[4] : parts[0] === 'j' ? undefined : parts[0],
    };
  const account = /^([a-z0-9-]+)\.workable\.com$/.exec(host)?.[1];
  if (account && !['www', 'apply', 'jobs'].includes(account))
    return { provider: 'workable', slug: account };
  if (/^(?:www\.)?comeet\.com?$/.test(host)) {
    if (parts[0] === 'jobs') return { provider: 'comeet', slug: parts[2] };
    if (parts[0] === 'careers-api') {
      const token = url.searchParams.get('token');
      return { provider: 'comeet', slug: parts[3], ...(token ? { token } : {}) };
    }
    return { provider: 'comeet' };
  }
  return null;
}
/**
 * Accept a board name or a pasted public board link and return what it reveals. A Comeet careers
 * page link gives the company UID; only a careers API link also carries the token.
 */
export function boardFromLink(value: string): BoardLink {
  const trimmed = value.trim();
  if (!/[/]/.test(trimmed) && !/\.(?:io|co|com)\b/i.test(trimmed)) return { slug: trimmed };
  try {
    const url = new URL(/^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`);
    const match = linkParts(url);
    if (!match) return { slug: trimmed };
    return { ...match, slug: match.slug ? decodeURIComponent(match.slug) : trimmed };
  } catch {
    return { slug: trimmed };
  }
}
/** Accept a pasted Comeet token, or a careers API link that holds both the UID and token. */
export function tokenFromInput(value: string): BoardLink {
  const link = boardFromLink(value);
  return link.token ? link : { token: value.trim() };
}
/** Test needs every identifier the provider uses. */
export function canTest(draft: SourceDraft): boolean {
  return !!draft.slug.trim() && (!tokenProviders.has(draft.provider) || !!draft.token.trim());
}
export function draftInput(draft: SourceDraft): JobSourceInput {
  return {
    provider: draft.provider,
    slug: draft.slug.trim(),
    ...(tokenProviders.has(draft.provider) ? { token: draft.token.trim() } : {}),
    name: draft.name.trim(),
    enabled: draft.enabled,
    filters: {
      titleInclude: keywordList(draft.titleInclude),
      titleExclude: keywordList(draft.titleExclude),
      locationInclude: keywordList(draft.locationInclude),
      remoteOnly: draft.remoteOnly,
    },
  };
}
export function sourceDraft(source: JobSource): SourceDraft {
  return {
    provider: source.provider,
    slug: source.slug,
    token: source.token ?? '',
    name: source.name,
    enabled: source.enabled,
    titleInclude: source.filters.titleInclude.join(', '),
    titleExclude: source.filters.titleExclude.join(', '),
    locationInclude: source.filters.locationInclude.join(', '),
    remoteOnly: source.filters.remoteOnly,
  };
}
export function filterSummary(source: JobSource): string {
  const { titleInclude, titleExclude, locationInclude, remoteOnly } = source.filters;
  const parts = [
    titleInclude.length ? `titles with ${titleInclude.join(', ')}` : '',
    titleExclude.length ? `not ${titleExclude.join(', ')}` : '',
    locationInclude.length ? `in ${locationInclude.join(', ')}` : '',
    remoteOnly ? 'remote only' : '',
  ].filter(Boolean);
  return parts.length ? parts.join(' · ') : 'All postings';
}
export function lastScanText(source: JobSource): string {
  const scan = source.lastScan;
  if (!scan) return 'Not scanned yet';
  const when = new Date(scan.at).toLocaleString();
  if (scan.status === 'failed') return `Last scan failed ${when}: ${scan.error ?? 'unknown error'}`;
  return `Scanned ${when}: ${plural(scan.new, 'new lead')}, ${scan.duplicate} already on the board`;
}
export function scanSummaryText(summary: JobScanSummary): string {
  const parts = [
    `${plural(summary.new, 'new lead')}`,
    `${summary.duplicate} already on the board`,
    `${summary.filtered} filtered out`,
  ];
  if (summary.deferred) parts.push(`${summary.deferred} left for the next scan`);
  const failed = summary.failedSources ? ` ${plural(summary.failedSources, 'source')} failed.` : '';
  return `${parts.join(', ')}.${failed}`;
}
