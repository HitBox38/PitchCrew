import type { ReactElement, ReactNode } from 'react';
import { Button } from '@pitchcrew/design-system/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@pitchcrew/design-system/tooltip';
import { useSidebar } from '@pitchcrew/design-system/sidebar';

/** A 32px quiet icon button in the sidebar's top strip or rail, named by its tooltip. */
export const StripButton = ({
  label,
  hint,
  onClick,
  render,
  side,
  children,
}: {
  label: string;
  hint?: string;
  onClick?: () => void;
  /** A trigger element (e.g. a menu trigger) wrapping the button. */
  render?: ReactElement;
  side?: 'top' | 'right' | 'bottom' | 'left';
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
      <TooltipContent
        side={side ?? (state === 'collapsed' && !isMobile ? 'right' : 'bottom')}
        sideOffset={6}
      >
        {label}
        {hint ? <span className="sidebar-strip-hint"> {hint}</span> : null}
      </TooltipContent>
    </Tooltip>
  );
};
