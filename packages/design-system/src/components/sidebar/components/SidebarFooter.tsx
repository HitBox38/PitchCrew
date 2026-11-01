import type { SidebarFooterProps } from '../types.ts';
import { cn } from '../../../lib/utils.ts';

export const SidebarFooter = ({ className, ...props }: SidebarFooterProps) => {
  return (
    <div
      data-slot="sidebar-footer"
      data-sidebar="footer"
      className={cn('primitive:flex primitive:flex-col primitive:gap-2 primitive:p-2', className)}
      {...props}
    />
  );
};
