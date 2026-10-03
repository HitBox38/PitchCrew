import type { SidebarFooterProps } from '@/components/ui/sidebar/types.ts';
import { cn } from '@/lib/utils';

export function SidebarFooter({ className, ...props }: SidebarFooterProps) {
  return (
    <div
      data-slot="sidebar-footer"
      data-sidebar="footer"
      className={cn('primitive:flex primitive:flex-col primitive:gap-2 primitive:p-2', className)}
      {...props}
    />
  );
}
