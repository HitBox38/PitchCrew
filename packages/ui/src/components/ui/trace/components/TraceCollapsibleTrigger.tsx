import * as React from 'react';
import { cn } from '@/lib/utils.ts';
import { CollapsibleTrigger } from '@/components/ui/collapsible/components/CollapsibleTrigger.tsx';
import { ChevronRightIcon } from 'lucide-react';
import { TraceIcon } from './TraceIcon.tsx';

export function TraceCollapsibleTrigger({
  className,
  children,
  ...props
}: React.ComponentProps<typeof CollapsibleTrigger>) {
  return (
    <CollapsibleTrigger
      data-slot="trace-collapsible-trigger"
      className={cn(
        'group/trace-collapsible-trigger primitive:flex primitive:w-fit primitive:max-w-full primitive:min-w-0 primitive:cursor-pointer primitive:items-center primitive:gap-1 primitive:rounded-md primitive:text-left primitive:text-muted-foreground primitive:transition-colors primitive:outline-none primitive:hover:text-foreground primitive:focus-visible:ring-3 primitive:focus-visible:ring-ring/50 primitive:has-[[data-status=error]]:text-destructive',
        className,
      )}
      {...props}
    >
      {children}
      <TraceIcon className="primitive:transition-transform primitive:group-aria-expanded/trace-collapsible-trigger:rotate-90">
        <ChevronRightIcon />
      </TraceIcon>
    </CollapsibleTrigger>
  );
}
