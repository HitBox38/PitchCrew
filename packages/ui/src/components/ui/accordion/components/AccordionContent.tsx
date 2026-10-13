import type { AccordionContentProps } from '@/components/ui/accordion/types.ts';
import { cn } from '@/lib/utils.ts';
import { Accordion as AccordionPrimitive } from '@base-ui/react/accordion';

export function AccordionContent({ className, ...props }: AccordionContentProps) {
  return (
    <AccordionPrimitive.Panel
      data-slot="accordion-content"
      className={cn('primitive:overflow-hidden primitive:text-sm', className)}
      {...props}
    />
  );
}
