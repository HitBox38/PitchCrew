import type { PipelineReview } from '@pitchcrew/core';
import type { Action } from '@/WorkspaceStore/index.ts';
import { useState } from 'react';

export function useFollowupForm(review: PipelineReview, findingId: string, action: Action) {
  const previous = review.followups.find((item) => item.findingId === findingId);
  const [status, setStatus] = useState<'open' | 'evaluating' | 'resolved' | 'dismissed'>(
    previous?.status ?? 'open',
  );
  const [result, setResult] = useState(previous?.result ?? '');
  const [evidence, setEvidence] = useState(previous?.evidenceEventIds.join(', ') ?? '');
  const [metric, setMetric] = useState(previous?.metrics[0]?.name ?? '');
  const [value, setValue] = useState(previous?.metrics[0]?.value.toString() ?? '');
  const [unit, setUnit] = useState(previous?.metrics[0]?.unit ?? '');
  const [error, setError] = useState('');
  async function save() {
    setError('');
    try {
      const ids = evidence.trim() ? evidence.split(',').map((id) => Number(id.trim())) : [];
      if (ids.some((id) => !Number.isInteger(id) || id <= 0))
        throw new Error('Use positive event IDs separated by commas.');
      if (metric && (value.trim() === '' || !Number.isFinite(Number(value))))
        throw new Error('Enter a numeric metric value.');
      await action(`/pipeline-reviews/${review.id}/followup`, 'POST', {
        findingId,
        status,
        result,
        evidenceEventIds: ids,
        metrics: [
          ...(metric ? [{ name: metric, value: Number(value), unit }] : []),
          ...(previous?.metrics.slice(1) ?? []),
        ],
      });
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Could not save follow-up.');
    }
  }
  return {
    status,
    setStatus,
    result,
    setResult,
    evidence,
    setEvidence,
    metric,
    setMetric,
    value,
    setValue,
    unit,
    setUnit,
    error,
    save,
  };
}
