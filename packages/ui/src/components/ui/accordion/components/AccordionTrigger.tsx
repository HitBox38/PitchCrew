import type { AccordionTriggerProps } from '@/components/ui/accordion/types.ts';
import { cn } from '@/lib/utils.ts';
import { Accordion as AccordionPrimitive } from '@base-ui/react/accordion';
import { ChevronDown } from 'lucide-react';

export function AccordionTrigger({ className, children, ...props }: AccordionTriggerProps) {
  return (
    <AccordionPrimitive.Header data-slot="accordion-header" className="primitive:flex">
      <AccordionPrimitive.Trigger
        data-slot="accordion-trigger"
        className={cn(
          'primitive:flex primitive:w-full primitive:items-center primitive:justify-between primitive:gap-3 primitive:rounded-md primitive:py-3 primitive:text-left primitive:text-sm primitive:font-medium primitive:outline-none primitive:focus-visible:ring-[3px] primitive:focus-visible:ring-ring/50 primitive:disabled:pointer-events-none primitive:disabled:opacity-50 primitive:[&[data-panel-open]>.accordion-chevron]:rotate-180',
          className,
        )}
        {...props}
      >
        {children}
        <ChevronDown
          className="accordion-chevron primitive:size-4 primitive:shrink-0 primitive:text-muted-foreground primitive:transition-transform primitive:duration-150 primitive:motion-reduce:transition-none"
          aria-hidden="true"
        />
      </AccordionPrimitive.Trigger>
    </AccordionPrimitive.Header>
  );
}
