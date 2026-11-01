import { useId, useState } from 'react';
import { CalendarClock } from 'lucide-react';
import { Button } from '@pitchcrew/design-system/button';
import { Popover, PopoverTrigger } from '@pitchcrew/design-system/popover';
import { pickerDate, pickerLabel } from './helpers.ts';
import { PickerContent } from './components/PickerContent.tsx';
import type { DateTimePickerProps } from './types.ts';

export const DateTimePicker = (props: DateTimePickerProps) => {
  const { label, value, name, required, disabled } = props;
  const id = useId();
  const [open, setOpen] = useState(false);
  const date = pickerDate(value);
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <input
        className="sr-only"
        name={name}
        value={value}
        required={required}
        disabled={disabled}
        tabIndex={-1}
        aria-hidden="true"
        onChange={() => {}}
        onInvalid={(event) => {
          event.preventDefault();
          setOpen(true);
        }}
      />
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger
          render={
            <Button
              id={id}
              className="button date-time-trigger"
              disabled={disabled}
              aria-label={`${label}: ${pickerLabel(value)}`}
            />
          }
        >
          <span className={!date ? 'text-muted-foreground' : ''}>{pickerLabel(value)}</span>
          <CalendarClock size={16} aria-hidden="true" />
        </PopoverTrigger>
        <PickerContent {...props} id={id} close={() => setOpen(false)} />
      </Popover>
    </div>
  );
};
