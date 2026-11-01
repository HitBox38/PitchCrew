import { useId } from 'react';
import type { DraftFieldsProps } from '../types.ts';
import { RepeatFields } from './RepeatFields.tsx';
import { DateTimePicker } from '@/DateTimePicker/index.tsx';
import { Input } from '@pitchcrew/design-system/input';
import { Switch } from '@pitchcrew/design-system/switch';

export const ScheduleFields = (props: DraftFieldsProps) => {
  const { draft, change } = props;
  const enabledId = useId();
  return (
    <fieldset className="ui-field-group routine-group">
      <legend>Schedule</legend>
      <div className="routine-field-pair">
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
      <div className="routine-field-pair">
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
      <div className="routine-switch">
        <Switch
          id={enabledId}
          checked={draft.enabled}
          onCheckedChange={(enabled) => change({ enabled })}
        />
        <label htmlFor={enabledId}>Enabled</label>
      </div>
    </fieldset>
  );
};
