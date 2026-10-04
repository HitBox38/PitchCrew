import { Calendar } from '@/components/ui/calendar/index.tsx';
import { PopoverContent, PopoverTitle } from '@/components/ui/popover/index.tsx';
import { pickerDate, pickerValue } from '../helpers.ts';
import type { DateTimePickerProps } from '../types.ts';
import { TimeFields } from './TimeFields.tsx';
import { PickerActions } from './PickerActions.tsx';

export function PickerContent({
  id,
  label,
  value,
  onValueChange,
  required,
  close,
}: DateTimePickerProps & { id: string; close(): void }) {
  const date = pickerDate(value);
  const time = value.split('T')[1] || '09:00:00';
  return (
    <PopoverContent
      className="date-time-popup"
      initialFocus={() =>
        document
          .getElementById(`${id}-calendar`)
          ?.querySelector<HTMLElement>('button[data-selected]') ?? true
      }
    >
      <PopoverTitle className="sr-only">{label}</PopoverTitle>
      <Calendar
        id={`${id}-calendar`}
        mode="single"
        selected={date}
        defaultMonth={date}
        onSelect={(next) => {
          if (next) onValueChange(pickerValue(next, time));
        }}
      />
      <TimeFields
        value={time}
        onValueChange={(next) => onValueChange(pickerValue(date ?? new Date(), next))}
      >
        {(valid) => <PickerActions {...{ required, value, valid, onValueChange, close }} />}
      </TimeFields>
    </PopoverContent>
  );
}
