import { z } from 'zod';
import type { BrowserSnapshot } from './computer.ts';
import type { RoleId } from './states.ts';

export interface FormControl {
  selector: string;
  frame?: string;
  label: string;
  type: string;
  required: boolean;
  visible: boolean;
  disabled: boolean;
  accept: string;
  options: string[];
}
export const formAssessmentInput = z
  .object({
    fields: z
      .array(
        z
          .object({
            selector: z.string().min(1).max(500),
            frame: z.string().max(500).optional(),
            condition: z.string().max(1000).default(''),
            missingAnswer: z.string().max(2000).default(''),
          })
          .strict(),
      )
      .max(100),
    blockers: z.array(z.string().max(1000)).max(30).default([]),
    uninspected: z.array(z.string().max(1000)).max(30).default([]),
  })
  .strict();
export interface FormAssessment {
  id: string;
  cardId: string;
  roleId: RoleId;
  runId: string;
  page: Omit<BrowserSnapshot, 'screenshot'>;
  fields: (FormControl & { condition: string; missingAnswer: string; assessed: boolean })[];
  blockers: string[];
  uninspected: string[];
  createdAt: string;
}
export interface SubmissionAttempt {
  id: string;
  cardId: string;
  runId: string;
  roleId: RoleId;
  computerApprovalId: string;
  exportApprovalId: string;
  packetDigest: string;
  status: 'uncertain' | 'confirmed' | 'not_submitted';
  before: Omit<BrowserSnapshot, 'screenshot'>;
  confirmation?: Omit<BrowserSnapshot, 'screenshot'>;
  evidence?: string;
  externalConfirmation?: { url: string; evidence: string; verifiedAt: string; provenance: 'user' };
  createdAt: string;
  resolvedAt?: string;
}
