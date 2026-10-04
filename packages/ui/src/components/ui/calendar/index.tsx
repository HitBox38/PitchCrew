import { DayPicker, type DayPickerProps } from 'react-day-picker';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { calendarClasses } from './constants.ts';
import { CalendarDayButton } from './components/CalendarDayButton.tsx';

export function Calendar({ className, classNames, components, ...props }: DayPickerProps) {
  return (
    <DayPicker
      showOutsideDays
      className={cn('ui-calendar', className)}
      classNames={{ ...calendarClasses, ...classNames }}
      components={{
        DayButton: CalendarDayButton,
        Chevron: ({ orientation }) =>
          orientation === 'left' ? (
            <ChevronLeft size={16} aria-hidden="true" />
          ) : (
            <ChevronRight size={16} aria-hidden="true" />
          ),
        ...components,
      }}
      {...props}
    />
  );
}
