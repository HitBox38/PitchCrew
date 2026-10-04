import type { JobScanSummary, JobSource, JobSourceInput } from '@pitchcrew/core';
import { boardHosts } from './constants.ts';
import type { SourceDraft } from './types.ts';

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
/** Accept a board name or a pasted public board link and return the board name. */
export function boardFromLink(value: string): Partial<Pick<SourceDraft, 'provider' | 'slug'>> {
  const trimmed = value.trim();
  if (!/[/.]/.test(trimmed)) return { slug: trimmed };
  try {
    const url = new URL(/^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`);
    const match = boardHosts.find((item) => item.host.test(url.hostname.toLowerCase()));
    if (!match) return { slug: trimmed };
    const parts = url.pathname.split('/').filter(Boolean);
    const slug = url.hostname.startsWith('boards-api') ? parts[2] : parts[0];
    return slug ? { provider: match.provider, slug } : { slug: trimmed };
  } catch {
    return { slug: trimmed };
  }
}
export function draftInput(draft: SourceDraft): JobSourceInput {
  return {
    provider: draft.provider,
    slug: draft.slug.trim(),
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
