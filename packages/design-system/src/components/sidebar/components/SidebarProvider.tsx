import { SIDEBAR_WIDTH, SIDEBAR_WIDTH_ICON, SidebarContext } from '../constants.ts';
import { sidebarWrapperPresence } from '../wrapper-presence.ts';
import { useSidebarState } from '../hooks/useSidebarState.ts';
import type { SidebarProviderProps } from '../types.ts';
import { TooltipProvider } from '../../tooltip/components/TooltipProvider.tsx';
import { cn } from '../../../lib/utils.ts';
import * as React from 'react';

export const SidebarProvider = ({
  defaultOpen = true,
  open: openProp,
  onOpenChange: setOpenProp,
  preferRail = false,
  className,
  style,
  children,
  ...props
}: SidebarProviderProps) => {
  const wrapper = sidebarWrapperPresence.useRoot();
  const contextValue = useSidebarState({
    defaultOpen,
    open: openProp,
    onOpenChange: setOpenProp,
    preferRail,
  });
  return (
    <SidebarContext.Provider value={contextValue}>
      <TooltipProvider delay={0}>
        <wrapper.Provider value={wrapper.register}>
          <div
            data-slot="sidebar-wrapper"
            {...wrapper.attributes}
            style={
              {
                '--sidebar-width': SIDEBAR_WIDTH,
                '--sidebar-width-icon': SIDEBAR_WIDTH_ICON,
                ...style,
              } as React.CSSProperties
            }
            className={cn(
              'group/sidebar-wrapper primitive:flex primitive:min-h-svh primitive:w-full primitive:data-has-inset:bg-sidebar',
              className,
            )}
            {...props}
          >
            {children}
          </div>
        </wrapper.Provider>
      </TooltipProvider>
    </SidebarContext.Provider>
  );
};
