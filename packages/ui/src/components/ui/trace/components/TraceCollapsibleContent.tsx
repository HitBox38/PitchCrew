import * as React from 'react';
import { cn } from '@/lib/utils.ts';
import { CollapsibleContent } from '@/components/ui/collapsible/components/CollapsibleContent.tsx';

export function TraceCollapsibleContent({
  className,
  children,
  ...props
}: React.ComponentProps<typeof CollapsibleContent>) {
  return (
    <CollapsibleContent
      data-slot="trace-collapsible-content"
      className="primitive:h-(--collapsible-panel-height) primitive:min-w-0 primitive:overflow-hidden primitive:transition-[height] primitive:duration-200 primitive:data-ending-style:h-0 primitive:data-starting-style:h-0"
      {...props}
    >
      <div
        data-slot="trace-collapsible-content-inner"
        className={cn(
          'primitive:mt-2 primitive:mb-1 primitive:ml-[calc(--spacing(2)-1px)] primitive:min-w-0 primitive:border-l primitive:border-border primitive:pr-1 primitive:pl-4 primitive:leading-relaxed primitive:wrap-break-word primitive:text-muted-foreground',
          className,
        )}
      >
        {children}
      </div>
    </CollapsibleContent>
  );
}
