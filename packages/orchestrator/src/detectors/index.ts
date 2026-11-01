import { createHash, randomUUID } from 'node:crypto';
import {
  detectorCatalog,
  detectorCheckInput,
  detectorKeyInput,
  maxDetectorAdvisories,
  type Card,
  type DetectorAdvisory,
  type DetectorProvider,
} from '@pitchcrew/core';
import type { Board } from '@pitchcrew/board';
import type { FetchLike } from '../job-sources/fetch.ts';
import { DetectorKeyStore } from './keys.ts';
import { detectorAdapters, type DetectorRequest } from './providers.ts';

export const detectorTimeoutMs = 30_000;
export const detectorMaxResponseBytes = 1024 * 1024;

export const digestDocument = (text: string) =>
  createHash('sha256').update(text, 'utf8').digest('hex');

/** Never echo a credential: provider errors can quote request bodies or headers. */
const sanitize = (message: string, secrets: string[]) =>
  secrets.reduce(
    (text, secret) => (secret ? text.split(secret).join('[redacted]') : text),
    message,
  );

/**
 * User-only external AI-text detector checks. The agent gateway exposes nothing here; a check
 * uploads one packet document the user saw, bound by its digest, to the provider the user chose.
 */
export class DetectorManager {
  readonly keys: DetectorKeyStore;
  fetch: FetchLike = (url, init) => fetch(url, init);
  constructor(
    directory: string,
    private readonly board: Board,
  ) {
    this.keys = new DetectorKeyStore(directory);
  }
  initialize = () => this.keys.initialize();
  status = () => this.keys.status();
  revision = () => this.keys.revision();
  saveKey = (provider: DetectorProvider, data: unknown) => {
    const input = detectorKeyInput.parse(data);
    if (detectorCatalog[provider].secondary && !input.email)
      throw new Error(`${detectorCatalog[provider].name} needs the account email beside the key.`);
    return this.keys.set(provider, input);
  };
  removeKey = (provider: DetectorProvider) => this.keys.remove(provider);

  check = async (data: unknown, signal?: AbortSignal): Promise<DetectorAdvisory> => {
    const input = detectorCheckInput.parse(data);
    const entry = detectorCatalog[input.provider];
    const credential = this.keys.get(input.provider);
    if (!credential)
      throw new Error(`Add your ${entry.name} key in Settings > Writing before checking.`);
    const text = this.document(input.cardId, input.document);
    if (digestDocument(text) !== input.documentDigest)
      throw new Error(
        'This document changed since you reviewed it. Review the current text and check again.',
      );
    if (text.length < entry.minChars)
      throw new Error(
        `${entry.name} needs at least ${entry.minChars} characters; this document has ${text.length}.`,
      );
    if (text.length > entry.maxChars)
      throw new Error(
        `${entry.name} accepts at most ${entry.maxChars} characters; this document has ${text.length}.`,
      );
    const adapter = detectorAdapters[input.provider];
    const secrets = [credential.key, credential.email ?? ''];
    let outcome;
    try {
      const prepared = adapter.prepare
        ? await this.send(adapter.prepare(credential), adapter.hosts, signal)
        : undefined;
      const body = await this.send(
        adapter.request(credential, text, prepared),
        adapter.hosts,
        signal,
      );
      outcome = adapter.parse(body, text);
    } catch (error) {
      throw new Error(sanitize(error instanceof Error ? error.message : String(error), secrets));
    }
    // Recheck after the upload: the packet may have changed while the provider was working.
    if (digestDocument(this.document(input.cardId, input.document)) !== input.documentDigest)
      throw new Error('This document changed during the check. The result was not saved.');
    const advisory: DetectorAdvisory = {
      id: randomUUID(),
      provider: input.provider,
      document: input.document,
      documentDigest: input.documentDigest,
      checkedAt: new Date().toISOString(),
      score: outcome.score,
      confidence: outcome.confidence,
      passages: outcome.passages,
      ...(outcome.model ? { model: outcome.model } : {}),
    };
    this.board.db.transaction(() => {
      const card = this.board.get<Card>('card', input.cardId);
      const kept = (card.detectorAdvisories ?? []).filter(
        (item) => !(item.provider === advisory.provider && item.document === advisory.document),
      );
      this.board.updateCard(
        input.cardId,
        { detectorAdvisories: [...kept, advisory].slice(-maxDetectorAdvisories) },
        'user',
        `Checked the ${input.document === 'coverLetter' ? 'cover letter' : 'form answers'} with ${entry.name}`,
      );
    })();
    return advisory;
  };

  private document = (cardId: string, document: DetectorAdvisory['document']) => {
    const card = this.board.get<Card>('card', cardId);
    if (!card.packet) throw new Error('This job has no application draft to check.');
    const text = card.packet[document];
    if (!text.trim()) throw new Error('This document is empty.');
    return text;
  };

  /** HTTPS to the adapter's fixed hosts only, no redirects, bounded time and size. */
  private send = async (request: DetectorRequest, hosts: string[], signal?: AbortSignal) => {
    const url = new URL(request.url);
    if (url.protocol !== 'https:' || !hosts.includes(url.hostname))
      throw new Error('Detector requests go only to the provider’s documented API host.');
    const timeout = AbortSignal.timeout(detectorTimeoutMs);
    const response = await this.fetch(url.toString(), {
      ...request.init,
      redirect: 'error',
      signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
    }).catch((error: Error) => {
      throw new Error(
        error.name === 'TimeoutError' || error.name === 'AbortError'
          ? 'The detector did not answer in time.'
          : `Could not reach the detector: ${error.message}`,
      );
    });
    const declared = Number(response.headers.get('content-length') ?? '');
    if (Number.isFinite(declared) && declared > detectorMaxResponseBytes)
      throw new Error('The detector response is too large.');
    const raw = await response.arrayBuffer();
    if (raw.byteLength > detectorMaxResponseBytes)
      throw new Error('The detector response is too large.');
    const body = new TextDecoder().decode(raw);
    if (!response.ok)
      throw new Error(
        response.status === 401 || response.status === 403
          ? 'The detector rejected the saved key. Update it in Settings > Writing.'
          : `The detector answered with HTTP ${response.status}.`,
      );
    try {
      return JSON.parse(body) as unknown;
    } catch {
      throw new Error('The detector did not return JSON.');
    }
  };
}
