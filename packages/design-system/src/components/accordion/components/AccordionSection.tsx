import type { ReactNode } from 'react';
import { Accordion } from './Accordion.tsx';
import { AccordionItem } from './AccordionItem.tsx';
import { AccordionTrigger } from './AccordionTrigger.tsx';
import { AccordionContent } from './AccordionContent.tsx';

/** A standalone disclosure using the shared accordion controls. */
export const AccordionSection = ({
  heading,
  children,
  className,
  triggerClassName,
  contentClassName,
  defaultOpen = false,
  onOpenChange,
}: {
  heading: ReactNode;
  children: ReactNode;
  className?: string;
  triggerClassName?: string;
  contentClassName?: string;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
}) => {
  return (
    <Accordion
      className={className}
      defaultValue={defaultOpen ? ['section'] : []}
      onValueChange={(value) => onOpenChange?.(value.includes('section'))}
    >
      <AccordionItem value="section">
        <AccordionTrigger className={triggerClassName}>
          <span>{heading}</span>
        </AccordionTrigger>
        <AccordionContent keepMounted className={contentClassName}>
          {children}
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
};
