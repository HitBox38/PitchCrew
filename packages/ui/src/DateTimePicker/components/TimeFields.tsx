import { Label } from 'react-aria-components/Label';
import { TimeField, TimeInput } from '@/components/ui/time-field/index.tsx';
import { useTimeFields } from '../hooks/useTimeFields.ts';
import type { ReactNode } from 'react';

export function TimeFields({
  value,
  onValueChange,
  children,
}: {
  value: string;
  onValueChange(value: string): void;
  children(valid: boolean): ReactNode;
}) {
  const { time, change } = useTimeFields(value, onValueChange);
  return (
    <TimeField
      className="gap-0"
      value={time}
      hourCycle={24}
      granularity="second"
      isRequired
      onChange={change}
    >
      {({ state }) => (
        <>
          <div className="date-time-time">
            <Label>
              Time <span className="quiet font-normal">(24-hour)</span>
            </Label>
            <TimeInput />
          </div>
          {children(state.segments.every((segment) => !segment.isPlaceholder))}
        </>
      )}
    </TimeField>
  );
}
