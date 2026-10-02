import type { SidebarFooterProps } from '@/components/ui/sidebar/types.ts';
import { cn } from '@/lib/utils';

export function SidebarFooter({ className, ...props }: SidebarFooterProps) {
  return (
    <div
      data-slot="sidebar-footer"
      data-sidebar="footer"
      className={cn('flex flex-col gap-2 p-2', className)}
      {...props}
    />
  );
}
