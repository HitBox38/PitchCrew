import type { DraftFieldsProps, Frequency, RoutineDraft } from '../types.ts';
import { FormSelect } from '@/FormSelect/index.tsx';
import { Input } from '@/components/ui/input/index.tsx';

export function RepeatFields({ draft, change }: DraftFieldsProps) {
  return (
    <>
      <FormSelect
        label="Repeat"
        value={draft.frequency}
        onValueChange={(frequency) => change({ frequency: frequency as Frequency })}
        options={[
          { value: 'once', label: 'Once' },
          { value: 'interval', label: 'Every interval' },
          { value: 'daily', label: 'Daily at this time' },
          { value: 'weekdays', label: 'Weekdays at this time' },
          { value: 'weekly', label: 'Weekly on this day' },
          { value: 'monthly', label: 'Monthly on this date' },
          { value: 'custom', label: 'Custom cron expression' },
        ]}
      />
      {draft.frequency === 'interval' ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <label>
            Every
            <Input
              required
              type="number"
              min={1}
              step={1}
              value={draft.interval}
              onChange={(event) => change({ interval: event.target.value })}
            />
          </label>
          <FormSelect
            label="Unit"
            value={draft.unit}
            onValueChange={(unit) => change({ unit: unit as RoutineDraft['unit'] })}
            options={['minutes', 'hours', 'days', 'weeks'].map((value) => ({
              value,
              label: value[0]!.toUpperCase() + value.slice(1),
            }))}
          />
        </div>
      ) : null}
      {draft.frequency === 'custom' ? (
        <label>
          Cron expression
          <Input
            required
            value={draft.cron}
            onChange={(event) => change({ cron: event.target.value })}
            placeholder="0 9 * * 1-5"
          />
          <span className="quiet font-normal">
            Minute, hour, day, month, weekday. For example: 0 9 * * 1-5 runs at 9 AM on weekdays.
          </span>
        </label>
      ) : null}
      {draft.frequency === 'monthly' ? (
        <p className="quiet">Months without this date are skipped.</p>
      ) : null}
    </>
  );
}
