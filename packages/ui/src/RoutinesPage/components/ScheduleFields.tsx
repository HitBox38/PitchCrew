import type { DraftFieldsProps } from '../types.ts';
import { RepeatFields } from './RepeatFields.tsx';
import { DateTimePicker } from '@/DateTimePicker/index.tsx';
import { Input } from '@/components/ui/input/index.tsx';
import { Checkbox } from '@/components/ui/checkbox/index.tsx';

export function ScheduleFields(props: DraftFieldsProps) {
  const { draft, change } = props;
  return (
    <fieldset className="flex flex-col gap-4">
      <legend className="mb-3 font-semibold">When to run</legend>
      <div className="grid gap-4 sm:grid-cols-2">
        <DateTimePicker
          label="Start date and time"
          required
          value={draft.startLocal}
          onValueChange={(startLocal) => change({ startLocal })}
        />
        <label>
          Timezone
          <Input
            required
            value={draft.timezone}
            onChange={(event) => change({ timezone: event.target.value })}
            placeholder="Asia/Jerusalem"
          />
        </label>
      </div>
      <RepeatFields {...props} />
      <div className="grid gap-4 sm:grid-cols-2">
        <label>
          Stop after total runs
          <Input
            type="number"
            min={1}
            max={1000000}
            step={1}
            value={draft.maxRuns}
            onChange={(event) => change({ maxRuns: event.target.value })}
            placeholder="No limit"
          />
        </label>
        <DateTimePicker
          label="End date and time"
          value={draft.endLocal}
          onValueChange={(endLocal) => change({ endLocal })}
        />
      </div>
      <label className="checkbox-label">
        <Checkbox checked={draft.enabled} onCheckedChange={(enabled) => change({ enabled })} />
        <span>Enabled</span>
      </label>
    </fieldset>
  );
}
