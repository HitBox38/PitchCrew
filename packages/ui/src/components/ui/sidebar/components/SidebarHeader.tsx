import type { SidebarHeaderProps } from '@/components/ui/sidebar/types.ts';
import { cn } from '@/lib/utils';

export function SidebarHeader({ className, ...props }: SidebarHeaderProps) {
  return (
    <div
      data-slot="sidebar-header"
      data-sidebar="header"
      className={cn('primitive:flex primitive:flex-col primitive:gap-2 primitive:p-2', className)}
      {...props}
    />
  );
}
