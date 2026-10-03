import { MobileSidebar } from '@/components/ui/sidebar/components/MobileSidebar.tsx';
import { useSidebar } from '@/components/ui/sidebar/hooks/useSidebar.ts';
import type { SidebarProps } from '@/components/ui/sidebar/types.ts';
import { cn } from '@/lib/utils';

export function Sidebar({
  side = 'left',
  variant = 'sidebar',
  collapsible = 'offcanvas',
  className,
  children,
  ...props
}: SidebarProps) {
  const { isMobile, state } = useSidebar();

  if (collapsible === 'none') {
    return (
      <div
        data-slot="sidebar"
        className={cn(
          'primitive:flex primitive:h-full primitive:w-(--sidebar-width) primitive:flex-col primitive:bg-sidebar primitive:text-sidebar-foreground',
          className,
        )}
        {...props}
      >
        {children}
      </div>
    );
  }

  if (isMobile) {
    return (
      <MobileSidebar side={side} {...props}>
        {children}
      </MobileSidebar>
    );
  }

  return (
    <div
      className="group peer primitive:hidden primitive:text-sidebar-foreground primitive:md:block"
      data-state={state}
      data-collapsible={state === 'collapsed' ? collapsible : ''}
      data-variant={variant}
      data-side={side}
      data-slot="sidebar"
    >
      {/* This is what handles the sidebar gap on desktop */}
      <div
        data-slot="sidebar-gap"
        className={cn(
          'primitive:relative primitive:w-(--sidebar-width) primitive:bg-transparent primitive:transition-[width] primitive:duration-200 primitive:ease-linear',
          'primitive:group-data-[collapsible=offcanvas]:w-0',
          'primitive:group-data-[side=right]:rotate-180',
          variant === 'floating' || variant === 'inset'
            ? 'primitive:group-data-[collapsible=icon]:w-[calc(var(--sidebar-width-icon)+(--spacing(4)))]'
            : 'primitive:group-data-[collapsible=icon]:w-(--sidebar-width-icon)',
        )}
      />
      <div
        data-slot="sidebar-container"
        className={cn(
          'primitive:fixed primitive:inset-y-0 primitive:z-10 primitive:hidden primitive:h-svh primitive:w-(--sidebar-width) primitive:transition-[left,right,width] primitive:duration-200 primitive:ease-linear primitive:md:flex',
          side === 'left'
            ? 'primitive:left-0 primitive:group-data-[collapsible=offcanvas]:left-[calc(var(--sidebar-width)*-1)]'
            : 'primitive:right-0 primitive:group-data-[collapsible=offcanvas]:right-[calc(var(--sidebar-width)*-1)]',
          // Adjust the padding for floating and inset variants.
          variant === 'floating' || variant === 'inset'
            ? 'primitive:p-2 primitive:group-data-[collapsible=icon]:w-[calc(var(--sidebar-width-icon)+(--spacing(4))+2px)]'
            : 'primitive:group-data-[collapsible=icon]:w-(--sidebar-width-icon) primitive:group-data-[side=left]:border-r primitive:group-data-[side=right]:border-l',
          className,
        )}
        {...props}
      >
        <div
          data-sidebar="sidebar"
          data-slot="sidebar-inner"
          className="primitive:flex primitive:h-full primitive:w-full primitive:flex-col primitive:bg-sidebar primitive:group-data-[variant=floating]:rounded-lg primitive:group-data-[variant=floating]:border primitive:group-data-[variant=floating]:border-sidebar-border primitive:group-data-[variant=floating]:shadow-sm"
        >
          {children}
        </div>
      </div>
    </div>
  );
}
