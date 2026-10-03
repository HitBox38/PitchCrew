import type { FormControl } from './submissions.ts';
import { z } from 'zod';
import type { RoleId } from './states.ts';

const frame = z.string().trim().min(1).max(500).optional();
const submission = {
  purpose: z.literal('submission').optional(),
  exportApprovalId: z.uuid().optional(),
};
const selector = z.string().trim().min(1).max(500);
export const browserActionSchema = z.discriminatedUnion('kind', [
  z
    .object({
      kind: z.literal('dialog'),
      decision: z.enum(['accept', 'dismiss']),
      submissionAttemptId: z.uuid().optional(),
    })
    .strict(),
  z
    .object({
      kind: z.literal('navigate'),
      url: z
        .url()
        .max(2000)
        .refine((v) => {
          const url = new URL(v);
          return ['https:', 'http:'].includes(url.protocol) && !url.username && !url.password;
        }, 'Use an HTTP(S) URL without credentials.'),
    })
    .strict(),
  z.object({ kind: z.literal('click'), selector, frame, ...submission }).strict(),
  z.object({ kind: z.literal('fill'), selector, frame, value: z.string().max(12000) }).strict(),
  z.object({ kind: z.literal('select'), selector, frame, value: z.string().max(500) }).strict(),
  z
    .object({
      kind: z.literal('press'),
      frame,
      ...submission,
      selector,
      key: z.enum(['Tab', 'Enter', 'Escape', 'Space', 'ArrowDown', 'ArrowUp']),
    })
    .strict(),
  z
    .object({
      kind: z.literal('upload'),
      frame,
      selector,
      exportApprovalId: z.uuid(),
      file: z.enum([
        'resume.md',
        'cover_letter.md',
        'form_answers.md',
        'note.md',
        'resume.pdf',
        'resume.docx',
        'cover_letter.pdf',
        'cover_letter.docx',
      ]),
    })
    .strict(),
]);
export type BrowserAction = z.infer<typeof browserActionSchema>;
export interface BrowserSnapshot {
  url: string;
  title: string;
  text: string;
  screenshot: string;
  digest: string;
  controls?: FormControl[];
  dialog?: { type: string; message: string };
  uninspected?: string[];
}
export interface ComputerApproval {
  id: string;
  runId: string;
  roleId: RoleId;
  cardId: string | null;
  action: BrowserAction;
  reason: string;
  uploadContent?: string;
  uploadDigest?: string;
  uploadMimeType?: string;
  uploadPreview?: string;
  page: BrowserSnapshot;
  digest: string;
  status: 'pending' | 'approved' | 'rejected' | 'consumed' | 'failed';
  error: string;
  createdAt: string;
  decidedAt: string | null;
}
