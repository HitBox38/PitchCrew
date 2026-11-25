import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@pitchcrew/design-system/collapsible';
import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';

type ResponsiveDisclosureProps = {
  /** Narrow layouts: the trigger shows and the panel opens and closes. Wide: always open. */
  collapsible: boolean;
  /** The trigger's content (a title and a short fact); hidden while not collapsible. */
  trigger: ReactNode;
  children: ReactNode;
  /** Controlled open state while collapsible. */
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  className?: string;
  triggerClassName?: string;
  panelClassName?: string;
};

/**
 * One DOM for "collapsible when narrow, open when wide". Both states render the same trigger and
 * the same kept-mounted panel, so a resize remounts nothing: wide hides the trigger and forces the
 * panel open. A panel that holds focus as it becomes collapsible opens, so focus survives.
 */
export const ResponsiveDisclosure = ({
  collapsible,
  trigger,
  children,
  open,
  defaultOpen = false,
  onOpenChange,
  className,
  triggerClassName,
  panelClassName,
}: ResponsiveDisclosureProps) => {
  const panel = useRef<HTMLDivElement>(null);
  const was = useRef(collapsible);
  const [own, setOwn] = useState(defaultOpen);
  const expanded = open ?? own;
  const change = (next: boolean) => {
    setOwn(next);
    onOpenChange?.(next);
  };
  // Before paint, while the focused element is still inside the panel that is about to close.
  useLayoutEffect(() => {
    const became = collapsible && !was.current;
    was.current = collapsible;
    if (became && !expanded && panel.current?.contains(document.activeElement)) change(true);
  });
  return (
    <Collapsible
      open={!collapsible || expanded}
      onOpenChange={change}
      className={className}
      data-collapsible={collapsible ? '' : undefined}
    >
      <CollapsibleTrigger hidden={!collapsible} className={triggerClassName}>
        {trigger}
      </CollapsibleTrigger>
      <CollapsibleContent ref={panel} keepMounted className={panelClassName}>
        {children}
      </CollapsibleContent>
    </Collapsible>
  );
};
