import type { DraftFieldsProps, Frequency, RoutineDraft } from '../types.ts';

export function RepeatFields({ draft, change }: DraftFieldsProps) {
  return (
    <>
      <label>
        Repeat
        <select
          value={draft.frequency}
          onChange={(event) => change({ frequency: event.target.value as Frequency })}
        >
          <option value="once">Once</option>
          <option value="interval">Every interval</option>
          <option value="daily">Daily at this time</option>
          <option value="weekdays">Weekdays at this time</option>
          <option value="weekly">Weekly on this day</option>
          <option value="monthly">Monthly on this date</option>
          <option value="custom">Custom cron expression</option>
        </select>
      </label>
      {draft.frequency === 'interval' ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <label>
            Every
            <input
              required
              type="number"
              min={1}
              step={1}
              value={draft.interval}
              onChange={(event) => change({ interval: event.target.value })}
            />
          </label>
          <label>
            Unit
            <select
              value={draft.unit}
              onChange={(event) => change({ unit: event.target.value as RoutineDraft['unit'] })}
            >
              <option value="minutes">Minutes</option>
              <option value="hours">Hours</option>
              <option value="days">Days</option>
              <option value="weeks">Weeks</option>
            </select>
          </label>
        </div>
      ) : null}
      {draft.frequency === 'custom' ? (
        <label>
          Cron expression
          <input
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
