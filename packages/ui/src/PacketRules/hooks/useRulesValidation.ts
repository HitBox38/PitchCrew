import { useEffect, useState } from 'react';
import { validateRules } from '../api.ts';
import { validationDelay } from '../constants.ts';
import type { DraftResult, RuleIssue } from '../types.ts';

/** Debounced daemon validation, so regex safety rules have a single source of truth. */
export function useRulesValidation(draft: DraftResult, dirty: boolean) {
  const [result, setResult] = useState<{ for: DraftResult; issues: RuleIssue[] } | null>(null);
  useEffect(() => {
    if (!dirty || 'error' in draft) return;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      validateRules(draft.value, controller.signal)
        .then(({ issues }) => setResult({ for: draft, issues }))
        .catch((error: unknown) => {
          if (controller.signal.aborted) return;
          const message = error instanceof Error ? error.message : 'Could not check the rules.';
          setResult({ for: draft, issues: [{ path: [], message }] });
        });
    }, validationDelay);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [draft, dirty]);
  if (!dirty) return { issues: [], checking: false };
  if ('error' in draft) return { issues: [{ path: [], message: draft.error }], checking: false };
  if (result?.for !== draft) return { issues: [], checking: true };
  return { issues: result.issues, checking: false };
}
