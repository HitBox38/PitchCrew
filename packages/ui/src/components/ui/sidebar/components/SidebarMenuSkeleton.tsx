import type { SidebarMenuSkeletonProps } from '@/components/ui/sidebar/types.ts';
import { Skeleton } from '@/components/ui/skeleton/components/Skeleton.tsx';
import { cn } from '@/lib/utils';
import * as React from 'react';

export function SidebarMenuSkeleton({
  className,
  showIcon = false,
  ...props
}: SidebarMenuSkeletonProps) {
  // Random width between 50 to 90%.
  const [width] = React.useState(() => `${Math.floor(Math.random() * 40) + 50}%`);

  return (
    <div
      data-slot="sidebar-menu-skeleton"
      data-sidebar="menu-skeleton"
      className={cn(
        'primitive:flex primitive:h-8 primitive:items-center primitive:gap-2 primitive:rounded-md primitive:px-2',
        className,
      )}
      {...props}
    >
      {showIcon && (
        <Skeleton
          className="primitive:size-4 primitive:rounded-md"
          data-sidebar="menu-skeleton-icon"
        />
      )}
      <Skeleton
        className="primitive:h-4 primitive:max-w-(--skeleton-width) primitive:flex-1"
        data-sidebar="menu-skeleton-text"
        style={
          {
            '--skeleton-width': width,
          } as React.CSSProperties
        }
      />
    </div>
  );
}
