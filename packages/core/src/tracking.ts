import { z } from 'zod';
import { cardInput } from './cards.ts';
import type { CardState, RoleId } from './states.ts';

export const trackedStates = [
  'submitted',
  'screening',
  'interviewing',
  'offer',
  'rejected',
  'withdrawn',
  'ghosted',
] as const;
export const applicationQuery = z
  .object({
    company: z.string().trim().max(100).optional(),
    title: z.string().trim().max(160).optional(),
    url: z
      .string()
      .max(2000)
      .refine((value) => !value || !!canonicalJobUrl(value), 'Use an absolute job URL.')
      .optional(),
    jobIdentifier: z.string().trim().max(200).optional(),
    state: z.enum(trackedStates).optional(),
    offset: z.number().int().min(0).max(100000).default(0),
    limit: z.number().int().min(1).max(50).default(20),
  })
  .strict();
export const externalSubmissionInput = z
  .object({
    submittedAt: z.iso.datetime({ offset: true }),
    jobIdentifier: z.string().trim().max(200).default(''),
    note: z.string().trim().min(1).max(2000),
  })
  .strict();
export const externalApplicationInput = cardInput.extend(externalSubmissionInput.shape).strict();
export const trackingReconciliation = z
  .object({
    scanId: z.string().min(1).max(100),
    messageId: z.string().regex(/^[a-zA-Z0-9_-]{1,200}$/),
    company: z.string().trim().min(1).max(100),
    title: z.string().trim().min(1).max(160),
    state: z.enum(trackedStates),
    quote: z.string().trim().min(1).max(2000),
    ignoreReason: z.string().trim().min(1).max(1000).optional(),
  })
  .strict();
export interface ApplicationTracking {
  origin: 'external' | 'pitchcrew';
  submittedAt?: string;
  jobIdentifier?: string;
  note?: string;
  gmailThreads: { account: string; threadId: string }[];
}
export interface TrackingSignal {
  id: string;
  roleId: RoleId;
  runId: string;
  account: string;
  source: 'gmail';
  messageId: string;
  threadId: string;
  subject: string;
  from: string;
  quote: string;
  sourceText: string;
  sourceTruncated: boolean;
  effectiveAt: string;
  createdAt: string;
  company: string;
  title: string;
  state: CardState;
  candidateIds: string[];
  expectedCards: { id: string; state: CardState; updatedAt: string }[];
  cardId: string | null;
  status: 'pending' | 'applied' | 'ignored' | 'rejected';
  reason: string;
  decidedAt?: string;
}
export interface TrackingScan {
  id: string;
  roleId: RoleId;
  account: string;
  query: string;
  pageToken: string | null;
  nextPageToken: string | null;
  pendingIds: string[];
  complete: boolean;
  updatedAt: string;
}
export function normalizeApplicationText(value: string): string {
  return value.normalize('NFKC').toLowerCase().replace(/\s+/g, ' ').trim();
}
export function canonicalJobUrl(value: string): string {
  if (!value) return '';
  try {
    const url = new URL(value);
    url.hash = '';
    for (const key of [...url.searchParams.keys()])
      if (/^(utm_|ref$|source$|trk$|tracking)/i.test(key)) url.searchParams.delete(key);
    url.searchParams.sort();
    return url.toString().replace(/\/$/, '');
  } catch {
    return '';
  }
}
