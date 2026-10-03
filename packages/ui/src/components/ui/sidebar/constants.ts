import type { SidebarContextProps } from '@/components/ui/sidebar/types.ts';
import { cva } from 'class-variance-authority';
import * as React from 'react';

export const SIDEBAR_COOKIE_NAME = 'sidebar_state';

export const SIDEBAR_COOKIE_MAX_AGE = 60 * 60 * 24 * 7;

export const SIDEBAR_WIDTH = '16rem';

export const SIDEBAR_WIDTH_MOBILE = '18rem';

export const SIDEBAR_WIDTH_ICON = '3rem';

export const SIDEBAR_KEYBOARD_SHORTCUT = 'b';
export const SidebarContext = React.createContext<SidebarContextProps | null>(null);

export const sidebarMenuButtonVariants = cva(
  'peer/menu-button primitive:flex primitive:w-full primitive:items-center primitive:gap-2 primitive:overflow-hidden primitive:rounded-md primitive:p-2 primitive:text-left primitive:text-sm primitive:ring-sidebar-ring primitive:outline-hidden primitive:transition-[width,height,padding] primitive:group-has-data-[sidebar=menu-action]/menu-item:pr-8 primitive:group-data-[collapsible=icon]:size-8! primitive:group-data-[collapsible=icon]:p-2! primitive:hover:bg-sidebar-accent primitive:hover:text-sidebar-accent-foreground primitive:focus-visible:ring-2 primitive:active:bg-sidebar-accent primitive:active:text-sidebar-accent-foreground primitive:disabled:pointer-events-none primitive:disabled:opacity-50 primitive:aria-disabled:pointer-events-none primitive:aria-disabled:opacity-50 primitive:data-popup-open:hover:bg-sidebar-accent primitive:data-popup-open:hover:text-sidebar-accent-foreground primitive:data-active:bg-sidebar-accent primitive:data-active:font-medium primitive:data-active:text-sidebar-accent-foreground primitive:[&>span:last-child]:truncate primitive:[&>svg]:size-4 primitive:[&>svg]:shrink-0',
  {
    variants: {
      variant: {
        default: 'primitive:hover:bg-sidebar-accent primitive:hover:text-sidebar-accent-foreground',
        outline:
          'primitive:bg-background primitive:shadow-[0_0_0_1px_var(--sidebar-border)] primitive:hover:bg-sidebar-accent primitive:hover:text-sidebar-accent-foreground primitive:hover:shadow-[0_0_0_1px_var(--sidebar-accent)]',
      },
      size: {
        default: 'primitive:h-8 primitive:text-sm',
        sm: 'primitive:h-7 primitive:text-xs',
        lg: 'primitive:h-12 primitive:text-sm primitive:group-data-[collapsible=icon]:p-0!',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
);
