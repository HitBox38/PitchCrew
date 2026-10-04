import {
  canonicalJobUrl,
  cardInput,
  normalizeApplicationText,
  type Card,
  type JobPosting,
  type JobSource,
} from '@pitchcrew/core';
import { randomUUID } from 'node:crypto';
import type { Board } from '../index.ts';

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
/** Keys of every card ever added, in any state: a withdrawn lead is never re-added. */
export function discoveryKeys(board: Board): DiscoveryKeys {
  const keys: DiscoveryKeys = { ids: new Set(), urls: new Set(), identifiers: new Set() };
  for (const card of board.list<Card>('card')) {
    if (card.discovery)
      keys.ids.add(
        discoveryKey(card.discovery.provider, card.discovery.slug, card.discovery.jobId),
      );
    const url = canonicalJobUrl(card.url);
    if (url) keys.urls.add(url);
    if (card.tracking?.jobIdentifier)
      keys.identifiers.add(identifierKey(card.company, card.tracking.jobIdentifier));
  }
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
