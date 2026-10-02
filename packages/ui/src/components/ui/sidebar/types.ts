import { Button } from '@/components/ui/button/components/Button.tsx';
import { Input } from '@/components/ui/input/components/Input.tsx';
import { Separator } from '@/components/ui/separator/components/Separator.tsx';
import { sidebarMenuButtonVariants } from '@/components/ui/sidebar/constants.ts';
import { TooltipContent } from '@/components/ui/tooltip/components/TooltipContent.tsx';
import { useRender } from '@base-ui/react/use-render';
import { type VariantProps } from 'class-variance-authority';
import * as React from 'react';

export type SidebarContextProps = {
  state: 'expanded' | 'collapsed';
  open: boolean;
  setOpen: (open: boolean) => void;
  openMobile: boolean;
  setOpenMobile: (open: boolean) => void;
  isMobile: boolean;
  toggleSidebar: () => void;
};
export type MobileSidebarProps = React.ComponentProps<'div'> & { side: 'left' | 'right' };

export type SidebarProps = React.ComponentProps<'div'> & {
  side?: 'left' | 'right';
  variant?: 'sidebar' | 'floating' | 'inset';
  collapsible?: 'offcanvas' | 'icon' | 'none';
};

export type SidebarContentProps = React.ComponentProps<'div'>;

export type SidebarFooterProps = React.ComponentProps<'div'>;

export type SidebarGroupProps = React.ComponentProps<'div'>;
export type SidebarGroupActionProps = useRender.ComponentProps<'button'> &
  React.ComponentProps<'button'>;

export type SidebarGroupContentProps = React.ComponentProps<'div'>;

export type SidebarGroupLabelProps = useRender.ComponentProps<'div'> & React.ComponentProps<'div'>;

export type SidebarHeaderProps = React.ComponentProps<'div'>;
export type SidebarInputProps = React.ComponentProps<typeof Input>;

export type SidebarInsetProps = React.ComponentProps<'main'>;

export type SidebarMenuProps = React.ComponentProps<'ul'>;

export type SidebarMenuActionProps = useRender.ComponentProps<'button'> &
  React.ComponentProps<'button'> & {
    showOnHover?: boolean;
  };

export type SidebarMenuBadgeProps = React.ComponentProps<'div'>;
export type SidebarMenuButtonProps = useRender.ComponentProps<'button'> &
  React.ComponentProps<'button'> & {
    isActive?: boolean;
    tooltip?: string | React.ComponentProps<typeof TooltipContent>;
  } & VariantProps<typeof sidebarMenuButtonVariants>;

export type SidebarMenuItemProps = React.ComponentProps<'li'>;

export type SidebarMenuSkeletonProps = React.ComponentProps<'div'> & {
  showIcon?: boolean;
};

export type SidebarMenuSubProps = React.ComponentProps<'ul'>;

export type SidebarMenuSubButtonProps = useRender.ComponentProps<'a'> &
  React.ComponentProps<'a'> & {
    size?: 'sm' | 'md';
    isActive?: boolean;
  };

export type SidebarMenuSubItemProps = React.ComponentProps<'li'>;

export type SidebarProviderProps = React.ComponentProps<'div'> & {
  defaultOpen?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
};

export type SidebarRailProps = React.ComponentProps<'button'>;
export type SidebarSeparatorProps = React.ComponentProps<typeof Separator>;
export type SidebarTriggerProps = React.ComponentProps<typeof Button>;
