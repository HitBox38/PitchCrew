import type { AccordionItemProps } from '@/components/ui/accordion/types.ts';
import { cn } from '@/lib/utils.ts';
import { Accordion as AccordionPrimitive } from '@base-ui/react/accordion';

export function AccordionItem({ className, ...props }: AccordionItemProps) {
  return (
    <AccordionPrimitive.Item
      data-slot="accordion-item"
      className={cn(
        'primitive:border-b primitive:border-border primitive:last:border-b-0',
        className,
      )}
      {...props}
    />
  );
}
