import { SIDEBAR_WIDTH, SIDEBAR_WIDTH_ICON, SidebarContext } from '../constants.ts';
import { useSidebarState } from '../hooks/useSidebarState.ts';
import type { SidebarProviderProps } from '../types.ts';
import { TooltipProvider } from '../../tooltip/components/TooltipProvider.tsx';
import { cn } from '../../../lib/utils.ts';
import * as React from 'react';

export const SidebarProvider = ({
  defaultOpen = true,
  open: openProp,
  onOpenChange: setOpenProp,
  className,
  style,
  children,
  ...props
}: SidebarProviderProps) => {
  const contextValue = useSidebarState({ defaultOpen, open: openProp, onOpenChange: setOpenProp });
  return (
    <SidebarContext.Provider value={contextValue}>
      <TooltipProvider delay={0}>
        <div
          data-slot="sidebar-wrapper"
          style={
            {
              '--sidebar-width': SIDEBAR_WIDTH,
              '--sidebar-width-icon': SIDEBAR_WIDTH_ICON,
              ...style,
            } as React.CSSProperties
          }
          className={cn(
            'group/sidebar-wrapper primitive:flex primitive:min-h-svh primitive:w-full primitive:has-data-[variant=inset]:bg-sidebar',
            className,
          )}
          {...props}
        >
          {children}
        </div>
      </TooltipProvider>
    </SidebarContext.Provider>
  );
};
