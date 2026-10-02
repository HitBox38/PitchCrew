import { Separator } from '@/components/ui/separator/components/Separator.tsx';
import type { SidebarSeparatorProps } from '@/components/ui/sidebar/types.ts';
import { cn } from '@/lib/utils';

export function SidebarSeparator({ className, ...props }: SidebarSeparatorProps) {
  return (
    <Separator
      data-slot="sidebar-separator"
      data-sidebar="separator"
      className={cn('mx-2 w-auto bg-sidebar-border', className)}
      {...props}
    />
  );
}
