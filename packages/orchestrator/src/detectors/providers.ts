import { z } from 'zod';
import { maxDetectorPassages, type DetectorPassage, type DetectorProvider } from '@pitchcrew/core';
import type { StoredDetectorKey } from './keys.ts';

export interface DetectorRequest {
  url: string;
  init: RequestInit;
}
interface DetectorOutcome {
  score: number;
  confidence: 'normal' | 'low';
  passages: DetectorPassage[];
  model?: string;
}
export interface DetectorAdapter {
  /** Fixed official hosts; anything else is refused before a request is made. */
  hosts: string[];
  /** Some providers need a preliminary call (Copyleaks login) whose result feeds the check. */
  prepare?: (credential: StoredDetectorKey) => DetectorRequest;
  request: (credential: StoredDetectorKey, text: string, prepared?: unknown) => DetectorRequest;
  parse: (body: unknown, text: string) => DetectorOutcome;
}

const clamp = (value: number) => Math.min(1, Math.max(0, value));
const json = (body: unknown, headers: Record<string, string> = {}): RequestInit => ({
  method: 'POST',
  headers: { 'content-type': 'application/json', accept: 'application/json', ...headers },
  body: JSON.stringify(body),
});
/** Locate scored fragments in the checked text; fragments the provider altered are skipped. */
const locate = (text: string, fragments: { fragment: string; score: number }[]) => {
  const passages: DetectorPassage[] = [];
  let cursor = 0;
  for (const { fragment, score } of fragments) {
    const needle = fragment.trim();
    if (!needle) continue;
    const start = text.indexOf(needle, cursor);
    if (start < 0) continue;
    cursor = start + needle.length;
    passages.push({ start, end: cursor, score: clamp(score) });
    if (passages.length >= maxDetectorPassages) break;
  }
  return passages;
};
const unsupported = (provider: string) =>
  new Error(`${provider} returned a response Pitchcrew does not recognize. No result was saved.`);

const sapling: DetectorAdapter = {
  hosts: ['api.sapling.ai'],
  request: (credential, text) => ({
    url: 'https://api.sapling.ai/api/v1/aidetect',
    init: json({ key: credential.key, text, sent_scores: true, zero_retention: true }),
  }),
  parse: (body, text) => {
    const parsed = z
      .object({
        score: z.number(),
        low_confidence: z.boolean().optional(),
        sentence_scores: z.array(z.object({ sentence: z.string(), score: z.number() })).optional(),
      })
      .loose()
      .safeParse(body);
    if (!parsed.success) throw unsupported('Sapling');
    return {
      score: clamp(parsed.data.score),
      confidence: parsed.data.low_confidence || text.length < 500 ? 'low' : 'normal',
      passages: locate(
        text,
        (parsed.data.sentence_scores ?? []).map((s) => ({ fragment: s.sentence, score: s.score })),
      ),
    };
  },
};

const copyleaks: DetectorAdapter = {
  hosts: ['id.copyleaks.com', 'api.copyleaks.com'],
  prepare: (credential) => {
    if (!credential.email) throw new Error('Copyleaks needs the account email beside the key.');
    return {
      url: 'https://id.copyleaks.com/v3/account/login/api',
      init: json({ email: credential.email, key: credential.key }),
    };
  },
  request: (_credential, text, prepared) => {
    const login = z
      .object({ access_token: z.string().min(1) })
      .loose()
      .safeParse(prepared);
    if (!login.success) throw new Error('Copyleaks sign-in failed. Check the email and key.');
    return {
      url: `https://api.copyleaks.com/v2/writer-detector/pitchcrew-${Date.now().toString(36)}/check`,
      init: json({ text, sandbox: false }, { authorization: `Bearer ${login.data.access_token}` }),
    };
  },
  parse: (body, text) => {
    const parsed = z
      .object({
        summary: z.object({ ai: z.number(), human: z.number() }).loose(),
        results: z
          .array(
            z
              .object({
                classification: z.number(),
                probability: z.number().optional(),
                matches: z
                  .object({
                    text: z.object({
                      chars: z.object({
                        starts: z.array(z.number()),
                        lengths: z.array(z.number()),
                      }),
                    }),
                  })
                  .loose(),
              })
              .loose(),
          )
          .default([]),
        modelVersion: z.string().optional(),
      })
      .loose()
      .safeParse(body);
    if (!parsed.success) throw unsupported('Copyleaks');
    const passages: DetectorPassage[] = [];
    for (const result of parsed.data.results) {
      const ai = result.classification === 2;
      result.matches.text.chars.starts.forEach((start, index) => {
        const end = Math.min(text.length, start + result.matches.text.chars.lengths[index]);
        if (passages.length < maxDetectorPassages && end > start)
          passages.push({ start, end, score: ai ? clamp(result.probability ?? 1) : 0 });
      });
    }
    return {
      score: clamp(parsed.data.summary.ai),
      confidence: 'normal',
      passages,
      ...(parsed.data.modelVersion ? { model: parsed.data.modelVersion } : {}),
    };
  },
};

const gptzero: DetectorAdapter = {
  hosts: ['api.gptzero.me'],
  request: (credential, text) => ({
    url: 'https://api.gptzero.me/v2/predict/text',
    init: json({ document: text, multilingual: false }, { 'x-api-key': credential.key }),
  }),
  parse: (body, text) => {
    const parsed = z
      .object({
        version: z.string().optional(),
        documents: z
          .array(
            z
              .object({
                completely_generated_prob: z.number(),
                confidence_category: z.string().optional(),
                sentences: z
                  .array(z.object({ sentence: z.string(), generated_prob: z.number() }).loose())
                  .default([]),
              })
              .loose(),
          )
          .min(1),
      })
      .loose()
      .safeParse(body);
    if (!parsed.success) throw unsupported('GPTZero');
    const document = parsed.data.documents[0];
    return {
      score: clamp(document.completely_generated_prob),
      confidence: document.confidence_category === 'low' ? 'low' : 'normal',
      passages: locate(
        text,
        document.sentences.map((s) => ({ fragment: s.sentence, score: s.generated_prob })),
      ),
      ...(parsed.data.version ? { model: parsed.data.version } : {}),
    };
  },
};

const originality: DetectorAdapter = {
  hosts: ['api.originality.ai'],
  request: (credential, text) => ({
    url: 'https://api.originality.ai/api/v1/scan/ai',
    init: json(
      { content: text, storeScan: 'false', aiModelVersion: '1' },
      { 'X-OAI-API-KEY': credential.key },
    ),
  }),
  parse: (body, text) => {
    const parsed = z
      .object({
        score: z.object({ ai: z.number(), original: z.number() }).loose(),
        blocks: z
          .array(
            z.object({ text: z.string(), result: z.object({ fake: z.number() }).loose() }).loose(),
          )
          .default([]),
        ai_model_version: z.union([z.string(), z.number()]).optional(),
      })
      .loose()
      .safeParse(body);
    if (!parsed.success) throw unsupported('Originality.ai');
    return {
      score: clamp(parsed.data.score.ai),
      confidence: 'normal',
      passages: locate(
        text,
        parsed.data.blocks.map((b) => ({ fragment: b.text, score: b.result.fake })),
      ),
      ...(parsed.data.ai_model_version !== undefined
        ? { model: String(parsed.data.ai_model_version) }
        : {}),
    };
  },
};

export const detectorAdapters: Record<DetectorProvider, DetectorAdapter> = {
  sapling,
  copyleaks,
  gptzero,
  originality,
};
