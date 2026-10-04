// Adapted from @intentui/time-field; see README.md for registry sources.
import {
  TimeField as TimeFieldPrimitive,
  type TimeFieldProps,
  type TimeValue,
} from 'react-aria-components/TimeField';
import { cn } from '@/lib/utils';

export { TimeInput } from './components/TimeInput.tsx';

export function TimeField<T extends TimeValue>({ className, ...props }: TimeFieldProps<T>) {
  return (
    <TimeFieldPrimitive
      {...props}
      data-slot="time-field"
      className={(state) =>
        cn(
          'primitive:flex primitive:flex-col primitive:gap-1.5',
          typeof className === 'function' ? className(state) : className,
        )
      }
    />
  );
}
