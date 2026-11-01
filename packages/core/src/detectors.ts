import { z } from 'zod';

/** External AI-text detectors a user may connect with their own account. */
export const detectorProviders = ['sapling', 'copyleaks', 'gptzero', 'originality'] as const;
export type DetectorProvider = (typeof detectorProviders)[number];
/** Packet documents eligible for a detector check; resumes stay out of scope. */
export const detectorDocuments = ['coverLetter', 'formAnswers'] as const;
export type DetectorDocument = (typeof detectorDocuments)[number];

export interface DetectorCatalogEntry {
  id: DetectorProvider;
  name: string;
  /** Where the user creates the key; opened in the system browser. */
  docsUrl: string;
  /** Characters the provider needs; below this the check is refused locally before any upload. */
  minChars: number;
  maxChars: number;
  /** Second credential some providers require beside the key. */
  secondary?: { field: 'email'; label: string };
  /** What the provider documents about retention; shown before the user authorizes a check. */
  retention: string;
  billing: string;
  /** Whether the request contract was read from the provider's own documentation. */
  contract: 'documented' | 'unverified';
}
export const detectorCatalog: Record<DetectorProvider, DetectorCatalogEntry> = {
  sapling: {
    id: 'sapling',
    name: 'Sapling',
    docsUrl: 'https://sapling.ai/docs/api/detector/',
    minChars: 300,
    maxChars: 200_000,
    retention:
      'Pitchcrew sends zero_retention: true so Sapling does not keep a copy of the text. Results under 500 characters are low confidence.',
    billing: 'Usage-based per character on your Sapling account.',
    contract: 'documented',
  },
  copyleaks: {
    id: 'copyleaks',
    name: 'Copyleaks',
    docsUrl: 'https://docs.copyleaks.com/reference/actions/writer-detector/check',
    minChars: 255,
    maxChars: 100_000,
    secondary: { field: 'email', label: 'Account email' },
    retention:
      'Copyleaks does not document retention for this endpoint. Check your account terms before sharing application text.',
    billing: 'Credits per scan on your Copyleaks account.',
    contract: 'documented',
  },
  gptzero: {
    id: 'gptzero',
    name: 'GPTZero',
    docsUrl: 'https://docs.gptzero.me/',
    minChars: 250,
    maxChars: 50_000,
    retention:
      'GPTZero states that API inputs are not stored; its documentation could not be confirmed when this integration was written.',
    billing: 'Requires a paid GPTZero plan with API access.',
    contract: 'unverified',
  },
  originality: {
    id: 'originality',
    name: 'Originality.ai',
    docsUrl: 'https://docs.originality.ai/',
    minChars: 250,
    maxChars: 50_000,
    retention:
      'Pitchcrew asks Originality.ai not to store the scan. Its privacy policy allows scan history to be used for training unless you opt out in your account.',
    billing: 'Credits per 100 words on your Originality.ai account.',
    contract: 'unverified',
  },
};

/** A passage the provider scored, as character offsets into the checked document. */
export interface DetectorPassage {
  start: number;
  end: number;
  /** Share of the passage the provider attributes to AI writing, 0 to 1. */
  score: number;
}
/** Saved result of one external check, bound to the exact document text it scored. Event v33. */
export interface DetectorAdvisory {
  id: string;
  provider: DetectorProvider;
  document: DetectorDocument;
  /** SHA-256 hex of the UTF-8 document text at check time. */
  documentDigest: string;
  checkedAt: string;
  /** Share of the document the provider attributes to AI writing, 0 to 1. */
  score: number;
  confidence: 'normal' | 'low';
  passages: DetectorPassage[];
  model?: string;
}
export const maxDetectorPassages = 40;
/** Saved advisories per card; older provider/document pairs are replaced. */
export const maxDetectorAdvisories = 8;
export const detectorFlagThreshold = 0.5;

export interface DetectorStatus {
  provider: DetectorProvider;
  configured: boolean;
  savedAt?: string;
}
export const detectorCheckInput = z
  .object({
    cardId: z.uuid(),
    provider: z.enum(detectorProviders),
    document: z.enum(detectorDocuments),
    /** The digest of the exact text the user saw and authorized. */
    documentDigest: z.string().regex(/^[a-f0-9]{64}$/),
  })
  .strict();
export type DetectorCheckInput = z.infer<typeof detectorCheckInput>;
export const detectorKeyInput = z
  .object({
    key: z.string().trim().min(8).max(400),
    email: z.email().optional(),
  })
  .strict();
export type DetectorKeyInput = z.infer<typeof detectorKeyInput>;
/** Opening line of the prefilled chat draft; corrections quoting it never teach preferences. */
export const detectorRevisionPrefix = 'Revise for the AI-text detector advisory';
