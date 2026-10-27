import type { FormControl } from './submissions.ts';
import { z } from 'zod';
import type { RoleId } from './states.ts';

export const browserModeSchema = z.enum(['supervised', 'autonomous']);
export type BrowserMode = z.infer<typeof browserModeSchema>;
export interface BrowserSitePermission {
  id: string;
  roleId: RoleId;
  runId: string;
  taskId: string;
  origin: string;
  allowed: boolean;
  createdAt: string;
}
export interface BrowserSessionInfo {
  roleId: RoleId;
  runId: string | null;
  taskId: string;
  threadId: string | null;
  cardId: string | null;
  status: 'open' | 'closed';
  mode: BrowserMode;
  manual: boolean;
  allowedSites: string[];
  url: string;
  title: string;
}
export interface BrowserFrame {
  screenshot: string;
  width: number;
  height: number;
  url: string;
  title: string;
  warning?: string;
  dialog?: { type: string; message: string };
  /** Live-view page/viewport identity; never an action approval fingerprint. */
  generation?: number;
  status?: 'live' | 'fallback' | 'loading';
}
export const browserViewportSchema = z
  .object({
    width: z.number().int().min(240).max(2560),
    height: z.number().int().min(160).max(2160),
  })
  .strict();
export type BrowserViewport = z.infer<typeof browserViewportSchema>;
export const browserInputSchema = z.discriminatedUnion('kind', [
  z
    .object({
      kind: z.literal('click'),
      viewport: browserViewportSchema.optional(),
      generation: z.number().int().nonnegative().optional(),
      x: z.number().min(0).max(2560),
      y: z.number().min(0).max(2160),
    })
    .strict(),
  z
    .object({
      kind: z.literal('scroll'),
      deltaX: z.number().min(-2000).max(2000),
      deltaY: z.number().min(-2000).max(2000),
    })
    .strict(),
  z.object({ kind: z.literal('text'), text: z.string().max(12000) }).strict(),
  z
    .object({
      kind: z.literal('key'),
      key: z.enum([
        'Tab',
        'Shift+Tab',
        'Enter',
        'Escape',
        'Space',
        'Backspace',
        'Delete',
        'ArrowLeft',
        'ArrowRight',
        'ArrowUp',
        'ArrowDown',
        'Home',
        'End',
        'ControlOrMeta+A',
      ]),
    })
    .strict(),
  z.object({ kind: z.literal('navigate'), url: z.url().max(2000) }).strict(),
  z
    .object({
      kind: z.literal('dialog'),
      decision: z.enum(['accept', 'dismiss']),
      text: z.string().max(2000).optional(),
    })
    .strict(),
]);
export type BrowserInput = z.infer<typeof browserInputSchema>;

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
  viewport?: BrowserViewport;
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
  /** User granted this task site access; the server's form policy allowed this exact action. */
  automatic?: boolean;
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
