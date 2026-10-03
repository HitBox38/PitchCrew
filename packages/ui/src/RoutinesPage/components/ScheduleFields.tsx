import type { DraftFieldsProps } from '../types.ts';
import { RepeatFields } from './RepeatFields.tsx';

export function ScheduleFields(props: DraftFieldsProps) {
  const { draft, change } = props;
  return (
    <fieldset className="flex flex-col gap-4">
      <legend className="mb-3 font-semibold">When to run</legend>
      <div className="grid gap-4 sm:grid-cols-2">
        <label>
          Start date and time
          <input
            required
            type="datetime-local"
            step={1}
            value={draft.startLocal}
            onChange={(event) => change({ startLocal: event.target.value })}
          />
        </label>
        <label>
          Timezone
          <input
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
          <input
            type="number"
            min={1}
            max={1000000}
            step={1}
            value={draft.maxRuns}
            onChange={(event) => change({ maxRuns: event.target.value })}
            placeholder="No limit"
          />
        </label>
        <label>
          End date and time
          <input
            type="datetime-local"
            step={1}
            value={draft.endLocal}
            onChange={(event) => change({ endLocal: event.target.value })}
          />
        </label>
      </div>
      <label className="flex flex-row items-center gap-2">
        <input
          type="checkbox"
          checked={draft.enabled}
          onChange={(event) => change({ enabled: event.target.checked })}
        />{' '}
        Enabled
      </label>
    </fieldset>
  );
}
