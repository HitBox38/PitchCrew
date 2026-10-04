import { useEffect, useRef, type ComponentProps } from 'react';
import type { DayButton } from 'react-day-picker';
import { Button } from '@/components/ui/button/index.tsx';
import { cn } from '@/lib/utils';

export function CalendarDayButton({
  className,
  day,
  modifiers,
  ...props
}: ComponentProps<typeof DayButton>) {
  const ref = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (modifiers.focused) ref.current?.focus();
  }, [modifiers.focused]);
  return (
    <Button
      ref={ref}
      variant="ghost"
      className={cn('calendar-day-button', className)}
      data-day={day.date.toLocaleDateString('en-CA')}
      data-selected={modifiers.selected || undefined}
      {...props}
    />
  );
}
