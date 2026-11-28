import type { PacketRules } from './packet-rules.ts';

export const packetRuleLimits = {
  rules: 100,
  patterns: 50,
  patternLength: 300,
  values: 200,
  valueLength: 300,
  messageLength: 300,
  fileBytes: 256 * 1024,
} as const;

export const wordLimitBounds = { min: 1, max: 100_000 } as const;
export const bulletLimitBounds = { min: 0, max: 1000 } as const;
export const matchCountBounds = { min: 0, max: 1000 } as const;

export const defaultPacketWordLimits = { resume: 650, coverLetter: 500 } as const;

/** Built-in limits used when the data directory has no packet-rules.json. */
export const defaultPacketRules: PacketRules = {
  version: 1,
  rules: [
    {
      id: 'resume-length',
      kind: 'word_limit',
      severity: 'error',
      documents: ['resume'],
      max: defaultPacketWordLimits.resume,
      count: 'all',
    },
    {
      id: 'cover-letter-length',
      kind: 'word_limit',
      severity: 'error',
      documents: ['coverLetter'],
      max: defaultPacketWordLimits.coverLetter,
      count: 'all',
    },
  ],
};
