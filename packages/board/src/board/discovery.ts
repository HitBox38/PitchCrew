import {
  canonicalJobUrl,
  cardInput,
  jobLinkSourceId,
  jobProviderLabels,
  normalizeApplicationText,
  type Card,
  type CardInput,
  type JobLinkProvenance,
  type JobPosting,
  type JobSource,
} from '@pitchcrew/core';
import { randomUUID } from 'node:crypto';
import type { Board } from '../index.ts';
import { isLikelyDuplicateApplication } from './tracking.ts';

export interface DiscoveredPosting {
  source: Pick<JobSource, 'id' | 'name' | 'provider' | 'slug'>;
  posting: JobPosting;
}
export interface DiscoveryKeys {
  ids: Set<string>;
  urls: Set<string>;
  identifiers: Set<string>;
}
function discoveryKey(provider: string, slug: string, jobId: string) {
  return `${provider}:${slug.toLowerCase()}:${jobId}`;
}
function identifierKey(company: string, identifier: string) {
  return `${normalizeApplicationText(company)}\u0000${normalizeApplicationText(identifier)}`;
}
function addCardKeys(keys: DiscoveryKeys, card: Card) {
  if (card.discovery)
    keys.ids.add(discoveryKey(card.discovery.provider, card.discovery.slug, card.discovery.jobId));
  const url = canonicalJobUrl(card.url);
  if (url) keys.urls.add(url);
  if (card.tracking?.jobIdentifier)
    keys.identifiers.add(identifierKey(card.company, card.tracking.jobIdentifier));
}
const emptyKeys = (): DiscoveryKeys => ({
  ids: new Set(),
  urls: new Set(),
  identifiers: new Set(),
});
/** Keys of every card ever added, in any state: a withdrawn lead is never re-added. */
export function discoveryKeys(board: Board): DiscoveryKeys {
  const keys = emptyKeys();
  for (const card of board.list<Card>('card')) addCardKeys(keys, card);
  return keys;
}
export function isKnownPosting(keys: DiscoveryKeys, item: DiscoveredPosting): boolean {
  const { source, posting } = item;
  const url = canonicalJobUrl(posting.url);
  return (
    keys.ids.has(discoveryKey(source.provider, source.slug, posting.jobId)) ||
    (!!url && keys.urls.has(url)) ||
    keys.identifiers.has(identifierKey(source.name, posting.jobId))
  );
}
function remember(keys: DiscoveryKeys, item: DiscoveredPosting) {
  keys.ids.add(discoveryKey(item.source.provider, item.source.slug, item.posting.jobId));
  const url = canonicalJobUrl(item.posting.url);
  if (url) keys.urls.add(url);
  keys.identifiers.add(identifierKey(item.source.name, item.posting.jobId));
}
/**
 * Dedupe against all cards and create leads in one transaction, so concurrent board writes
 * cannot slip a duplicate between the check and the insert.
 */
export function recordDiscoveredLeads(
  board: Board,
  items: DiscoveredPosting[],
  actor: string,
  limit: number,
): {
  created: { card: Card; item: DiscoveredPosting }[];
  duplicate: DiscoveredPosting[];
  deferred: DiscoveredPosting[];
  invalid: DiscoveredPosting[];
} {
  return board.db.transaction(() => {
    const keys = discoveryKeys(board);
    const created: { card: Card; item: DiscoveredPosting }[] = [];
    const duplicate: DiscoveredPosting[] = [];
    const deferred: DiscoveredPosting[] = [];
    const invalid: DiscoveredPosting[] = [];
    for (const item of items) {
      if (isKnownPosting(keys, item)) {
        duplicate.push(item);
        continue;
      }
      if (created.length >= limit) {
        deferred.push(item);
        continue;
      }
      const { source, posting } = item;
      const parsed = cardInput.safeParse({
        company: source.name,
        title: posting.title.slice(0, 160),
        location: posting.location.slice(0, 120),
        url: posting.url,
        salary: posting.salary.slice(0, 100),
        description: posting.description.slice(0, 20000),
        tags: [],
      });
      // A malformed posting is skipped without failing the rest of the scan.
      if (!parsed.success) {
        invalid.push(item);
        continue;
      }
      const input = parsed.data;
      remember(keys, item);
      const now = new Date().toISOString();
      const card: Card = {
        ...input,
        id: randomUUID(),
        state: 'lead',
        fit: null,
        owner: null,
        packet: null,
        feedback: [],
        createdAt: now,
        updatedAt: now,
        sample: false,
        tracking: { origin: 'pitchcrew', jobIdentifier: posting.jobId, gmailThreads: [] },
        discovery: {
          provider: source.provider,
          sourceId: source.id,
          sourceName: source.name,
          slug: source.slug,
          jobId: posting.jobId,
          firstSeenAt: now,
          postedAt: posting.postedAt,
        },
      };
      board.record(
        'card',
        card,
        actor,
        `Discovered ${card.company}: ${card.title} on a ${source.provider} job board`,
      );
      created.push({ card, item });
    }
    return { created, duplicate, deferred, invalid };
  })();
}
/**
 * Cards a fetched posting may duplicate: any card discovery would treat as the same posting
 * (provider/board/job ID, canonical URL or same-company job identifier), plus the company/title
 * match used for external registration. Checked against every card, in any state.
 */
export function postingMatches(
  board: Board,
  posting: {
    provider: JobPosting['provider'];
    slug: string;
    jobId: string;
    company: string;
    title: string;
    urls: string[];
  },
): Card[] {
  const urls = posting.urls.map(canonicalJobUrl).filter(Boolean);
  const id = discoveryKey(posting.provider, posting.slug, posting.jobId);
  const identifier = identifierKey(posting.company, posting.jobId);
  return board.list<Card>('card').filter((card) => {
    const keys = emptyKeys();
    addCardKeys(keys, card);
    return (
      keys.ids.has(id) ||
      urls.some((url) => keys.urls.has(url)) ||
      keys.identifiers.has(identifier) ||
      urls.some((url) =>
        isLikelyDuplicateApplication(card, {
          company: posting.company,
          title: posting.title,
          url,
          jobIdentifier: posting.jobId,
        }),
      )
    );
  });
}
/**
 * Save a job the user fetched from a posting link. It gets the same `discovery` provenance and
 * job identifier as a discovered lead, so later scans skip it. Duplicates stay the user's call.
 */
export function recordLinkedJob(
  board: Board,
  input: CardInput,
  link: JobLinkProvenance,
  actor = 'user',
): Card {
  const now = new Date().toISOString();
  const card: Card = {
    ...input,
    id: randomUUID(),
    state: 'lead',
    fit: null,
    owner: null,
    packet: null,
    feedback: [],
    createdAt: now,
    updatedAt: now,
    sample: false,
    tracking: { origin: 'pitchcrew', jobIdentifier: link.jobId, gmailThreads: [] },
    discovery: {
      provider: link.provider,
      sourceId: jobLinkSourceId,
      sourceName: link.board,
      slug: link.board,
      jobId: link.jobId,
      firstSeenAt: now,
      postedAt: link.postedAt,
    },
  };
  board.record(
    'card',
    card,
    actor,
    `Added ${card.company} from a ${jobProviderLabels[link.provider]} job link`,
  );
  return card;
}
