import * as React from 'react';
import { cn } from '@/lib/utils.ts';
import { Collapsible } from '@/components/ui/collapsible/components/Collapsible.tsx';

export function TraceCollapsible({
  className,
  ...props
}: Omit<React.ComponentProps<typeof Collapsible>, 'open'> &
  (
    | { open?: undefined }
    | {
        open: boolean;
        onOpenChange: NonNullable<React.ComponentProps<typeof Collapsible>['onOpenChange']>;
      }
  )) {
  return (
    <Collapsible
      data-slot="trace-collapsible"
      className={cn(
        'primitive:flex primitive:w-full primitive:min-w-0 primitive:flex-col',
        className,
      )}
      {...props}
    />
  );
}
