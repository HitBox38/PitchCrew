import type { AccordionProps } from '@/components/ui/accordion/types.ts';
import { Accordion as AccordionPrimitive } from '@base-ui/react/accordion';

export function Accordion(props: AccordionProps) {
  return <AccordionPrimitive.Root data-slot="accordion" {...props} />;
}
