import { api } from '@/api.ts';
import type { RuleIssue } from './types.ts';

export function validateRules(value: unknown, signal: AbortSignal) {
  return api<{ valid: boolean; issues: RuleIssue[] }>(
    '/packet-rules/validate',
    'POST',
    value,
    signal,
  );
}
