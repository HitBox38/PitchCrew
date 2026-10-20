import { api } from '@/api.ts';
import type { RuleIssue } from './types.ts';

export const validateRules = (value: unknown, signal: AbortSignal) => {
  return api<{ valid: boolean; issues: RuleIssue[] }>(
    '/packet-rules/validate',
    'POST',
    value,
    signal,
  );
};
