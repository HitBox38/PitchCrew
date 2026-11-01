import { afterEach, expect, it, vi } from 'vitest';
import { readFile, stat } from 'node:fs/promises';
import { join } from 'node:path';
import type { Card, DetectorAdvisory, Snapshot } from '@pitchcrew/core';
import { packet } from '../../board/test/fixtures/packet.ts';
import { digestDocument } from '../src/detectors/index.ts';
import { cleanup, confirmFixtureApplication, setup } from './helpers/daemon.ts';

afterEach(cleanup);
const coverLetter = `${'I built the shipment tracking API in TypeScript on Node.js, serving forty regional depots. '.repeat(6)}Reduced latency with partial indexes.`;
const response = (body: unknown, status = 200, type = 'application/json') =>
  new Response(typeof body === 'string' ? body : JSON.stringify(body), {
    status,
    headers: { 'content-type': type },
  });
const prepared = async (port: number) => {
  const env = await setup(port);
  const card = env.daemon.service.createCard({ company: 'Fictional detector', title: 'Engineer' });
  await confirmFixtureApplication(env.request, card.id);
  env.daemon.service.board.updateCard(
    card.id,
    { packet: { ...packet, coverLetter } },
    'user',
    'fixture',
  );
  const digest = digestDocument(coverLetter);
  return { ...env, card, digest };
};

it('saves a key on this device only, runs a user-authorized check and binds the result to the digest', async () => {
  const { daemon, directory, request, card, digest } = await prepared(24651);
  const fetch = vi.fn(async () =>
    response({
      score: 0.74,
      sentence_scores: [{ sentence: 'Reduced latency with partial indexes.', score: 0.9 }],
    }),
  );
  daemon.service.detectors.fetch = fetch;
  const saved = await request<Snapshot['quality']>('/detectors/sapling/key', 'PUT', {
    key: 'sk-fixture-secret-key',
  });
  expect(saved.response.status).toBe(200);
  const file = join(directory, 'detectors', 'keys.json');
  expect((await stat(file)).mode & 0o777).toBe(0o600);
  expect(await readFile(file, 'utf8')).toContain('sk-fixture-secret-key');
  const snapshot = (await request<Snapshot>('/snapshot')).result;
  expect(snapshot.quality!.detectors.find((s) => s.provider === 'sapling')).toMatchObject({
    configured: true,
  });
  expect(JSON.stringify(snapshot)).not.toContain('sk-fixture-secret-key');

  const check = await request<DetectorAdvisory>('/detectors/check', 'POST', {
    cardId: card.id,
    provider: 'sapling',
    document: 'coverLetter',
    documentDigest: digest,
  });
  expect(check.response.status).toBe(200);
  expect(check.result).toMatchObject({
    provider: 'sapling',
    document: 'coverLetter',
    documentDigest: digest,
    score: 0.74,
    confidence: 'normal',
    passages: [{ score: 0.9 }],
  });
  const [url, init] = fetch.mock.calls[0] as unknown as [string, RequestInit];
  expect(url).toBe('https://api.sapling.ai/api/v1/aidetect');
  expect(init.redirect).toBe('error');
  const body = JSON.parse(init.body as string);
  expect(body).toMatchObject({
    key: 'sk-fixture-secret-key',
    text: coverLetter,
    zero_retention: true,
  });
  expect(body.text).not.toContain('Built React interfaces.');
  const saved2 = daemon.service.board.get<Card>('card', card.id);
  expect(saved2.detectorAdvisories).toHaveLength(1);
  expect(daemon.service.board.events().at(-1)!.version).toBe(33);

  // A second check of the same document replaces the earlier result for that provider.
  await request('/detectors/check', 'POST', {
    cardId: card.id,
    provider: 'sapling',
    document: 'coverLetter',
    documentDigest: digest,
  });
  expect(daemon.service.board.get<Card>('card', card.id).detectorAdvisories).toHaveLength(1);

  const removed = await request('/detectors/sapling/key', 'DELETE');
  expect(removed.response.status).toBe(200);
  expect(await readFile(file, 'utf8')).not.toContain('sk-fixture-secret-key');
  const again = await request<{ error: string }>('/detectors/check', 'POST', {
    cardId: card.id,
    provider: 'sapling',
    document: 'coverLetter',
    documentDigest: digest,
  });
  expect(again.result.error).toContain('Add your Sapling key');
});

it('refuses stale digests, short or empty documents, and never saves a failed check or echoes the key', async () => {
  const { daemon, request, card, digest } = await prepared(24652);
  await request('/detectors/sapling/key', 'PUT', { key: 'sk-fixture-secret-key' });
  const stale = await request<{ error: string }>('/detectors/check', 'POST', {
    cardId: card.id,
    provider: 'sapling',
    document: 'coverLetter',
    documentDigest: digestDocument('something else'),
  });
  expect(stale.result.error).toContain('changed since you reviewed it');
  const empty = await request<{ error: string }>('/detectors/check', 'POST', {
    cardId: card.id,
    provider: 'sapling',
    document: 'formAnswers',
    documentDigest: digestDocument(''),
  });
  expect(empty.result.error).toContain('empty');
  daemon.service.board.updateCard(
    card.id,
    { packet: { ...packet, formAnswers: 'Short answer.' } },
    'user',
    'fixture',
  );
  const short = await request<{ error: string }>('/detectors/check', 'POST', {
    cardId: card.id,
    provider: 'sapling',
    document: 'formAnswers',
    documentDigest: digestDocument('Short answer.'),
  });
  expect(short.result.error).toContain('at least 300 characters');

  daemon.service.detectors.fetch = vi.fn(async () =>
    response({ error: 'bad key sk-fixture-secret-key' }, 401),
  );
  daemon.service.board.updateCard(
    card.id,
    { packet: { ...packet, coverLetter } },
    'user',
    'fixture',
  );
  const rejected = await request<{ error: string }>('/detectors/check', 'POST', {
    cardId: card.id,
    provider: 'sapling',
    document: 'coverLetter',
    documentDigest: digest,
  });
  expect(rejected.result.error).toContain('rejected the saved key');
  expect(rejected.result.error).not.toContain('sk-fixture');
  daemon.service.detectors.fetch = vi.fn(async () => response('<html>', 200, 'text/html'));
  const html = await request<{ error: string }>('/detectors/check', 'POST', {
    cardId: card.id,
    provider: 'sapling',
    document: 'coverLetter',
    documentDigest: digest,
  });
  expect(html.result.error).toContain('did not return JSON');
  daemon.service.detectors.fetch = vi.fn(async () => response({ unexpected: true }));
  const odd = await request<{ error: string }>('/detectors/check', 'POST', {
    cardId: card.id,
    provider: 'sapling',
    document: 'coverLetter',
    documentDigest: digest,
  });
  expect(odd.result.error).toContain('does not recognize');
  expect(daemon.service.board.get<Card>('card', card.id).detectorAdvisories).toBeUndefined();
});

it('runs the Copyleaks sign-in before the check and requires the account email', async () => {
  const { daemon, request, card, digest } = await prepared(24653);
  const missing = await request<{ error: string }>('/detectors/copyleaks/key', 'PUT', {
    key: 'copyleaks-fixture-key',
  });
  expect(missing.result.error).toContain('account email');
  await request('/detectors/copyleaks/key', 'PUT', {
    key: 'copyleaks-fixture-key',
    email: 'person@example.com',
  });
  const calls: string[] = [];
  daemon.service.detectors.fetch = vi.fn(async (url: string) => {
    calls.push(url);
    return url.startsWith('https://id.copyleaks.com/')
      ? response({ access_token: 'token-1' })
      : response({
          summary: { ai: 0.2, human: 0.8 },
          results: [
            { classification: 1, matches: { text: { chars: { starts: [0], lengths: [10] } } } },
          ],
          modelVersion: 'v11.0',
        });
  });
  const check = await request<DetectorAdvisory>('/detectors/check', 'POST', {
    cardId: card.id,
    provider: 'copyleaks',
    document: 'coverLetter',
    documentDigest: digest,
  });
  expect(check.result).toMatchObject({ provider: 'copyleaks', score: 0.2, model: 'v11.0' });
  expect(calls).toEqual([
    'https://id.copyleaks.com/v3/account/login/api',
    expect.stringMatching(/^https:\/\/api\.copyleaks\.com\/v2\/writer-detector\//),
  ]);
});

it('keeps detector routes behind the local UI session', async () => {
  const { daemon, card, digest } = await prepared(24654);
  const response = await fetch(`${daemon.url}/api/detectors/check`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      cardId: card.id,
      provider: 'sapling',
      document: 'coverLetter',
      documentDigest: digest,
    }),
  });
  expect(response.status).toBe(403);
});
