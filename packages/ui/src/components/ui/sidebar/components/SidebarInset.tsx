import type { SidebarInsetProps } from '@/components/ui/sidebar/types.ts';
import { cn } from '@/lib/utils';

export function SidebarInset({ className, ...props }: SidebarInsetProps) {
  return (
    <main
      data-slot="sidebar-inset"
      className={cn(
        'primitive:relative primitive:flex primitive:w-full primitive:flex-1 primitive:flex-col primitive:bg-background',
        'primitive:md:peer-data-[variant=inset]:m-2 primitive:md:peer-data-[variant=inset]:ml-0 primitive:md:peer-data-[variant=inset]:rounded-xl primitive:md:peer-data-[variant=inset]:shadow-sm primitive:md:peer-data-[variant=inset]:peer-data-[state=collapsed]:ml-2',
        className,
      )}
      {...props}
    />
  );
}
