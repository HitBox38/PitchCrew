import type { PipelineReview } from '@pitchcrew/core';
import type { Action } from '@/WorkspaceStore/index.ts';
import { Button } from '@/components/ui/button/components/Button.tsx';
import { Input } from '@/components/ui/input/index.tsx';
import { Textarea } from '@/components/ui/textarea/index.tsx';
import { useFollowupForm } from '../hooks/useFollowupForm.ts';

export function FollowupForm({
  review,
  findingId,
  working,
  action,
}: {
  review: PipelineReview;
  findingId: string;
  working: boolean;
  action: Action;
}) {
  const form = useFollowupForm(review, findingId, action);
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        void form.save();
      }}
      className="space-y-3 pt-3"
    >
      <label className="block">
        Follow-up state
        <select
          className="block w-full rounded border p-2"
          value={form.status}
          onChange={(event) => form.setStatus(event.target.value as typeof form.status)}
        >
          <option value="open">Open</option>
          <option value="evaluating">Evaluating</option>
          <option value="resolved">Resolved</option>
          <option value="dismissed">Dismissed</option>
        </select>
      </label>
      <label className="block">
        Result
        <Textarea
          maxLength={2000}
          value={form.result}
          onChange={(event) => form.setResult(event.target.value)}
        />
      </label>
      <label className="block">
        Evidence event IDs (comma separated)
        <Input value={form.evidence} onChange={(event) => form.setEvidence(event.target.value)} />
      </label>
      <div className="grid grid-cols-3 gap-2">
        <label>
          Metric
          <Input value={form.metric} onChange={(event) => form.setMetric(event.target.value)} />
        </label>
        <label>
          Value
          <Input
            type="number"
            step="any"
            value={form.value}
            onChange={(event) => form.setValue(event.target.value)}
          />
        </label>
        <label>
          Unit
          <Input value={form.unit} onChange={(event) => form.setUnit(event.target.value)} />
        </label>
      </div>
      {form.error ? <p role="alert">{form.error}</p> : null}
      <Button type="submit" disabled={working}>
        Save follow-up
      </Button>
    </form>
  );
}
