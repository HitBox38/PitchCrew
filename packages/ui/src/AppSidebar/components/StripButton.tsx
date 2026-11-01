import type { ReactElement, ReactNode } from 'react';
import { Button } from '@/components/ui/button/components/Button.tsx';
import { Tooltip } from '@/components/ui/tooltip/components/Tooltip.tsx';
import { TooltipContent } from '@/components/ui/tooltip/components/TooltipContent.tsx';
import { TooltipTrigger } from '@/components/ui/tooltip/components/TooltipTrigger.tsx';
import { useSidebar } from '@/components/ui/sidebar/hooks/useSidebar.ts';

/** A 32px quiet icon button in the sidebar's top strip or rail, named by its tooltip. */
export const StripButton = ({
  label,
  hint,
  onClick,
  render,
  children,
}: {
  label: string;
  hint?: string;
  onClick?: () => void;
  /** A trigger element (e.g. a menu trigger) wrapping the button. */
  render?: ReactElement;
  children: ReactNode;
}) => {
  const { state, isMobile } = useSidebar();
  const button = (
    <Button
      variant="ghost"
      size="icon-sm"
      className="sidebar-strip-button"
      aria-label={label}
      onClick={onClick}
    />
  );
  return (
    <Tooltip>
      <TooltipTrigger render={render ?? button}>{children}</TooltipTrigger>
      <TooltipContent side={state === 'collapsed' && !isMobile ? 'right' : 'bottom'} sideOffset={6}>
        {label}
        {hint ? <span className="sidebar-strip-hint"> {hint}</span> : null}
      </TooltipContent>
    </Tooltip>
  );
};
