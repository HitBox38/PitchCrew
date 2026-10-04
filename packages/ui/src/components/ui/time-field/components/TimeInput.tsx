// Adapted from Intent UI's DateInput, shared by its TimeField registry component.
import {
  DateInput as DateInputPrimitive,
  DateSegment,
  type DateInputProps,
} from 'react-aria-components/DateField';
import { cn } from '@/lib/utils';

export function TimeInput({ className, ...props }: Omit<DateInputProps, 'children'>) {
  return (
    <DateInputPrimitive
      {...props}
      data-slot="time-input"
      className={(state) =>
        cn(
          'primitive:flex primitive:h-9 primitive:items-center primitive:rounded-md primitive:border primitive:border-input primitive:px-3 primitive:text-sm primitive:tabular-nums',
          'primitive:focus-within:ring-[3px] primitive:focus-within:ring-ring/50',
          typeof className === 'function' ? className(state) : className,
        )
      }
    >
      {(segment) => (
        <DateSegment
          segment={segment}
          data-slot="time-segment"
          className="primitive:rounded primitive:px-0.5 primitive:py-1 primitive:caret-transparent primitive:outline-none primitive:data-[focused]:bg-primary primitive:data-[focused]:text-primary-foreground primitive:data-[placeholder]:text-muted-foreground primitive:data-[type=literal]:px-0"
        />
      )}
    </DateInputPrimitive>
  );
}
