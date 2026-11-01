import { describe, expect, it } from 'vitest';
import { detectorAdapters } from '../src/detectors/providers.ts';

const text =
  'I built the shipment tracking API in TypeScript. It served forty regional depots. Later I reduced query latency with partial indexes.';
const credential = { key: 'sk-fixture-key', email: 'person@example.com', savedAt: '' };

describe('detector adapters', () => {
  it('sapling sends zero retention and maps sentence scores to offsets', () => {
    const { url, init } = detectorAdapters.sapling.request(credential, text);
    expect(url).toBe('https://api.sapling.ai/api/v1/aidetect');
    expect(JSON.parse(init.body as string)).toMatchObject({
      zero_retention: true,
      sent_scores: true,
    });
    const outcome = detectorAdapters.sapling.parse(
      {
        score: 0.82,
        sentence_scores: [
          { sentence: 'I built the shipment tracking API in TypeScript.', score: 0.9 },
          { sentence: 'Rewritten by the provider.', score: 0.4 },
          { sentence: 'Later I reduced query latency with partial indexes.', score: 0.3 },
        ],
      },
      text,
    );
    expect(outcome.score).toBe(0.82);
    expect(outcome.confidence).toBe('low');
    expect(outcome.passages).toEqual([
      { start: 0, end: 48, score: 0.9 },
      { start: text.indexOf('Later'), end: text.length, score: 0.3 },
    ]);
  });
  it('copyleaks signs in first, then checks with the bearer token and keeps section offsets', () => {
    const login = detectorAdapters.copyleaks.prepare!(credential);
    expect(login.url).toBe('https://id.copyleaks.com/v3/account/login/api');
    expect(() => detectorAdapters.copyleaks.prepare!({ ...credential, email: undefined })).toThrow(
      'account email',
    );
    const { url, init } = detectorAdapters.copyleaks.request(credential, text, {
      access_token: 'token-1',
    });
    expect(url).toMatch(
      /^https:\/\/api\.copyleaks\.com\/v2\/writer-detector\/pitchcrew-[a-z0-9]+\/check$/,
    );
    expect((init.headers as Record<string, string>).authorization).toBe('Bearer token-1');
    expect(JSON.parse(init.body as string)).toEqual({ text, sandbox: false });
    expect(() => detectorAdapters.copyleaks.request(credential, text, { error: 'x' })).toThrow(
      'sign-in failed',
    );
    const outcome = detectorAdapters.copyleaks.parse(
      {
        summary: { ai: 0.35, human: 0.65 },
        results: [
          {
            classification: 2,
            probability: 0.7,
            matches: { text: { chars: { starts: [0], lengths: [48] } } },
          },
          { classification: 1, matches: { text: { chars: { starts: [49], lengths: [34] } } } },
        ],
        modelVersion: 'v11.0',
      },
      text,
    );
    expect(outcome).toEqual({
      score: 0.35,
      confidence: 'normal',
      passages: [
        { start: 0, end: 48, score: 0.7 },
        { start: 49, end: 83, score: 0 },
      ],
      model: 'v11.0',
    });
  });
  it('gptzero uses the api key header and the first document', () => {
    const { url, init } = detectorAdapters.gptzero.request(credential, text);
    expect(url).toBe('https://api.gptzero.me/v2/predict/text');
    expect((init.headers as Record<string, string>)['x-api-key']).toBe('sk-fixture-key');
    const outcome = detectorAdapters.gptzero.parse(
      {
        version: '2026-01',
        documents: [
          {
            completely_generated_prob: 0.12,
            confidence_category: 'high',
            sentences: [{ sentence: 'It served forty regional depots.', generated_prob: 0.2 }],
          },
        ],
      },
      text,
    );
    expect(outcome).toEqual({
      score: 0.12,
      confidence: 'normal',
      passages: [{ start: 49, end: 81, score: 0.2 }],
      model: '2026-01',
    });
  });
  it('originality asks not to store the scan and maps blocks', () => {
    const { init } = detectorAdapters.originality.request(credential, text);
    expect(JSON.parse(init.body as string)).toMatchObject({ storeScan: 'false', content: text });
    expect((init.headers as Record<string, string>)['X-OAI-API-KEY']).toBe('sk-fixture-key');
    const outcome = detectorAdapters.originality.parse(
      {
        score: { ai: 0.6, original: 0.4 },
        blocks: [
          {
            text: 'I built the shipment tracking API in TypeScript.',
            result: { fake: 0.8, real: 0.2 },
          },
        ],
        ai_model_version: 3,
      },
      text,
    );
    expect(outcome).toEqual({
      score: 0.6,
      confidence: 'normal',
      passages: [{ start: 0, end: 48, score: 0.8 }],
      model: '3',
    });
  });
  it('rejects unrecognized responses instead of inventing a clean result', () => {
    for (const provider of ['sapling', 'copyleaks', 'gptzero', 'originality'] as const)
      expect(() => detectorAdapters[provider].parse({ unexpected: true }, text)).toThrow(
        'does not recognize',
      );
  });
});
