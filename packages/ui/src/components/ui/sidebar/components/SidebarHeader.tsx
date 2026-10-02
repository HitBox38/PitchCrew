import type { SidebarHeaderProps } from '@/components/ui/sidebar/types.ts';
import { cn } from '@/lib/utils';

export function SidebarHeader({ className, ...props }: SidebarHeaderProps) {
  return (
    <div
      data-slot="sidebar-header"
      data-sidebar="header"
      className={cn('flex flex-col gap-2 p-2', className)}
      {...props}
    />
  );
}
