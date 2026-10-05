import {
  discoveryKeys,
  isKnownPosting,
  recordDiscoveredLeads,
  type Board,
  type DiscoveredPosting,
} from '@pitchcrew/board';
import {
  jobScanInput,
  jobSourceFields,
  jobSourceInput,
  refineJobSource,
  maxJobSources,
  maxNewLeadsPerScan,
  type JobLookupResult,
  type JobPosting,
  type JobScanSummary,
  type JobSource,
  type JobSourcePreview,
  type JobSourceScanResult,
} from '@pitchcrew/core';
import { randomUUID } from 'node:crypto';
import { readFile, rename, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { z } from 'zod';
import { fetchBoard, ProviderRateLimiter, type FetchLike } from './fetch.ts';
import { matchesFilters } from './filters.ts';
import { lookupJobLink } from './lookup.ts';
import {
  parsePostings,
  providerStatusMessages,
  redactToken,
  sourceEndpoint,
  truncatedResponse,
} from './providers.ts';

export const scanDeadlineMs = 180_000;
// Files saved before Comeet and Workable have no token and still parse unchanged.
const storedSources = z.array(
  jobSourceFields
    .extend({
      id: z.uuid(),
      createdAt: z.string(),
      updatedAt: z.string(),
      lastScan: z
        .object({
          at: z.string(),
          status: z.enum(['ok', 'failed']),
          error: z.string().max(500).optional(),
          fetched: z.number().int().min(0),
          new: z.number().int().min(0),
          duplicate: z.number().int().min(0),
          filtered: z.number().int().min(0),
        })
        .optional(),
    })
    .superRefine(refineJobSource),
);
interface Fetched {
  source: JobSource;
  postings: JobPosting[];
  error?: string;
  skipped?: boolean;
}

/**
 * User-configured public job boards, saved in job-sources.json outside the event log. Agents can
 * only trigger scans of these saved sources; every source change goes through user HTTP routes.
 */
export class JobSourceManager {
  private queue: Promise<unknown> = Promise.resolve();
  private scanning = false;
  private readonly lifetime = new AbortController();
  readonly limiter = new ProviderRateLimiter();
  constructor(
    readonly directory: string,
    readonly board: Board,
  ) {}
  /** The only network entry point; tests replace it with recorded fixtures. */
  fetch: FetchLike = (url, init) => fetch(url, init);
  private get path() {
    return join(this.directory, 'job-sources.json');
  }
  async list(): Promise<JobSource[]> {
    try {
      return storedSources.parse(JSON.parse(await readFile(this.path, 'utf8')));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return [];
      throw error;
    }
  }
  private mutate<T>(change: (sources: JobSource[]) => { sources: JobSource[]; result: T }) {
    const next = this.queue.then(async () => {
      const { sources, result } = change(await this.list());
      const temporary = `${this.path}.${randomUUID()}.tmp`;
      try {
        await writeFile(temporary, JSON.stringify(sources, null, 2), { mode: 0o600 });
        await rename(temporary, this.path);
      } finally {
        await rm(temporary, { force: true });
      }
      return result;
    });
    this.queue = next.catch(() => {});
    return next;
  }
  private assertUnique(
    sources: JobSource[],
    candidate: Pick<JobSource, 'provider' | 'slug'>,
    id?: string,
  ) {
    if (
      sources.some(
        (source) =>
          source.id !== id &&
          source.provider === candidate.provider &&
          source.slug.toLowerCase() === candidate.slug.toLowerCase(),
      )
    )
      throw new Error('This job board is already a source.');
  }
  add(value: unknown): Promise<JobSource> {
    const input = jobSourceInput.parse(value);
    return this.mutate((sources) => {
      if (sources.length >= maxJobSources)
        throw new Error(`Keep at most ${maxJobSources} job sources.`);
      this.assertUnique(sources, input);
      const now = new Date().toISOString();
      const source: JobSource = { ...input, id: randomUUID(), createdAt: now, updatedAt: now };
      return { sources: [...sources, source], result: source };
    });
  }
  update(id: string, value: unknown): Promise<JobSource> {
    const input = jobSourceInput.parse(value);
    return this.mutate((sources) => {
      const current = sources.find((source) => source.id === id);
      if (!current) throw new Error('Job source not found.');
      this.assertUnique(sources, input, id);
      // A different board starts without the previous board's scan status.
      const moved =
        current.provider !== input.provider ||
        current.slug !== input.slug ||
        current.token !== input.token;
      const source: JobSource = {
        ...input,
        id,
        createdAt: current.createdAt,
        updatedAt: new Date().toISOString(),
        ...(current.lastScan && !moved ? { lastScan: current.lastScan } : {}),
      };
      return { sources: sources.map((item) => (item.id === id ? source : item)), result: source };
    });
  }
  remove(id: string): Promise<void> {
    return this.mutate((sources) => {
      if (!sources.some((source) => source.id === id)) throw new Error('Job source not found.');
      return { sources: sources.filter((source) => source.id !== id), result: undefined };
    });
  }
  private async read(source: Pick<JobSource, 'provider' | 'slug' | 'token'>, signal: AbortSignal) {
    let body: unknown;
    try {
      const url = sourceEndpoint(source.provider, source.slug, source.token);
      const statusMessages = providerStatusMessages[source.provider];
      body = await this.limiter.schedule(
        source.provider,
        () => fetchBoard(this.fetch, url, { signal, statusMessages }),
        signal,
      );
    } catch (error) {
      // Scan errors reach the UI, saved scan status and agents; never echo the careers token.
      if (!(error instanceof Error)) throw error;
      throw new Error(redactToken(error.message, source.token));
    }
    return {
      postings: parsePostings(source.provider, source.slug, body, source.token),
      truncated: truncatedResponse(source.provider, body),
    };
  }
  /** Show what a source would match without creating cards or saving anything. */
  async preview(value: unknown, signal?: AbortSignal): Promise<JobSourcePreview> {
    const input = jobSourceInput.parse(value);
    const combined = AbortSignal.any([this.lifetime.signal, ...(signal ? [signal] : [])]);
    const { postings, truncated } = await this.read(input, combined);
    const matching = postings.filter((posting) => matchesFilters(posting, input.filters));
    const keys = discoveryKeys(this.board);
    const source = { id: 'preview', name: input.name, provider: input.provider, slug: input.slug };
    const known = matching.map((posting) => isKnownPosting(keys, { source, posting }));
    return {
      fetched: postings.length,
      matching: matching.length,
      filtered: postings.length - matching.length,
      duplicate: known.filter(Boolean).length,
      truncated,
      postings: matching.slice(0, 25).map((posting, index) => ({
        jobId: posting.jobId,
        title: posting.title,
        location: posting.location,
        remote: posting.remote,
        url: posting.url,
        onBoard: known[index]!,
      })),
    };
  }
  /** Read one posting from a pasted link for the Add job form. User-only; creates nothing. */
  lookup(value: unknown, signal?: AbortSignal): Promise<JobLookupResult> {
    return lookupJobLink(value, {
      fetch: (url, init) => this.fetch(url, init),
      limiter: this.limiter,
      board: this.board,
      sources: () => this.list(),
      signal: AbortSignal.any([this.lifetime.signal, ...(signal ? [signal] : [])]),
    });
  }
  /**
   * Scan saved, enabled sources and add new matching postings as leads. `recentMs` skips sources
   * scanned successfully within that window so scheduled agent scans cannot hammer public APIs.
   */
  async scan(options: {
    actor: string;
    input?: unknown;
    signal?: AbortSignal;
    recentMs?: number;
    authorize?: () => void;
  }): Promise<JobScanSummary> {
    const { sourceIds } = jobScanInput.parse(options.input ?? {});
    if (this.scanning) throw new Error('A job source scan is already running.');
    this.scanning = true;
    try {
      const all = await this.list();
      for (const id of sourceIds ?? [])
        if (!all.some((source) => source.id === id)) throw new Error('Job source not found.');
      const selected = all.filter((source) => !sourceIds || sourceIds.includes(source.id));
      const deadline = AbortSignal.timeout(scanDeadlineMs);
      const signal = AbortSignal.any([
        this.lifetime.signal,
        deadline,
        ...(options.signal ? [options.signal] : []),
      ]);
      const now = Date.now();
      const fetched = await Promise.all(
        selected.map(async (source): Promise<Fetched> => {
          if (!source.enabled) return { source, postings: [], skipped: true, error: 'Paused.' };
          if (
            options.recentMs &&
            source.lastScan?.status === 'ok' &&
            now - Date.parse(source.lastScan.at) < options.recentMs
          )
            return { source, postings: [], skipped: true, error: 'Scanned recently.' };
          try {
            return { source, postings: (await this.read(source, signal)).postings };
          } catch (error) {
            const message =
              deadline.aborted && !options.signal?.aborted
                ? 'The scan time limit was reached.'
                : error instanceof Error
                  ? error.message
                  : 'Could not read the job board.';
            return { source, postings: [], error: message.slice(0, 500) };
          }
        }),
      );
      if (options.signal?.aborted || this.lifetime.signal.aborted)
        throw new Error('The scan was cancelled.');
      return await this.mutate((sources) => {
        options.authorize?.();
        if (options.signal?.aborted || this.lifetime.signal.aborted)
          throw new Error('The scan was cancelled.');
        const passing: DiscoveredPosting[] = [];
        const results = new Map<string, JobSourceScanResult>();
        for (const item of fetched) {
          const { source } = item;
          const current = sources.find((value) => value.id === source.id);
          const changed =
            !current ||
            JSON.stringify([
              current.provider,
              current.slug,
              current.token,
              current.name,
              current.enabled,
              current.filters,
            ]) !==
              JSON.stringify([
                source.provider,
                source.slug,
                source.token,
                source.name,
                source.enabled,
                source.filters,
              ]);
          const { postings, error, skipped } = changed
            ? {
                postings: [],
                error: 'The source changed during the scan. Scan it again.',
                skipped: true,
              }
            : item;
          const matches = postings.filter((posting) => matchesFilters(posting, source.filters));
          results.set(source.id, {
            sourceId: source.id,
            name: source.name,
            provider: source.provider,
            status: skipped ? 'skipped' : error ? 'failed' : 'ok',
            ...(error ? { error } : {}),
            fetched: postings.length,
            new: 0,
            duplicate: 0,
            filtered: postings.length - matches.length,
            deferred: 0,
          });
          passing.push(...matches.map((posting) => ({ source, posting })));
        }
        const recorded = recordDiscoveredLeads(
          this.board,
          passing,
          options.actor,
          maxNewLeadsPerScan,
        );
        for (const { item } of recorded.created) results.get(item.source.id)!.new += 1;
        for (const item of recorded.duplicate) results.get(item.source.id)!.duplicate += 1;
        for (const item of recorded.deferred) results.get(item.source.id)!.deferred += 1;
        for (const item of recorded.invalid) results.get(item.source.id)!.filtered += 1;
        const scannedAt = new Date().toISOString();
        const updatedSources = sources.map((source) => {
          const result = results.get(source.id);
          if (!result || result.status === 'skipped') return source;
          return {
            ...source,
            lastScan: {
              at: scannedAt,
              status: result.status === 'ok' ? ('ok' as const) : ('failed' as const),
              ...(result.error ? { error: result.error } : {}),
              fetched: result.fetched,
              new: result.new,
              duplicate: result.duplicate,
              filtered: result.filtered,
            },
          };
        });
        const list = [...results.values()];
        const total = (key: 'new' | 'duplicate' | 'filtered' | 'deferred') =>
          list.reduce((sum, item) => sum + item[key], 0);
        return {
          sources: updatedSources,
          result: {
            scannedAt,
            new: total('new'),
            duplicate: total('duplicate'),
            filtered: total('filtered'),
            deferred: total('deferred'),
            failedSources: list.filter((item) => item.status === 'failed').length,
            sources: list,
            newLeads: recorded.created.map(({ card, item }) => ({
              id: card.id,
              company: card.company,
              title: card.title,
              location: card.location,
              url: card.url,
              sourceId: item.source.id,
              excerpt: card.description.slice(0, 1500),
            })),
          },
        };
      });
    } finally {
      this.scanning = false;
    }
  }
  close() {
    this.lifetime.abort();
  }
}
