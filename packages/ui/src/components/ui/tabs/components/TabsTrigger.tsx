import type { TabsTriggerProps } from '@/components/ui/tabs/types.ts';
import { cn } from '@/lib/utils';
import { Tabs as TabsPrimitive } from '@base-ui/react/tabs';

export function TabsTrigger({ className, ...props }: TabsTriggerProps) {
  return (
    <TabsPrimitive.Tab
      data-slot="tabs-trigger"
      className={cn(
        "primitive:relative primitive:inline-flex primitive:h-[calc(100%-1px)] primitive:flex-1 primitive:items-center primitive:justify-center primitive:gap-1.5 primitive:rounded-md primitive:border primitive:border-transparent primitive:px-2 primitive:py-1 primitive:text-sm primitive:font-medium primitive:whitespace-nowrap primitive:text-foreground/60 primitive:transition-[color,background-color,border-color,box-shadow] primitive:group-data-vertical/tabs:w-full primitive:group-data-vertical/tabs:justify-start primitive:hover:text-foreground primitive:focus-visible:border-ring primitive:focus-visible:ring-[3px] primitive:focus-visible:ring-ring/50 primitive:focus-visible:outline-1 primitive:focus-visible:outline-ring primitive:disabled:pointer-events-none primitive:disabled:opacity-50 primitive:aria-disabled:pointer-events-none primitive:aria-disabled:opacity-50 primitive:dark:text-muted-foreground primitive:dark:hover:text-foreground primitive:group-data-[variant=default]/tabs-list:data-active:shadow-sm primitive:group-data-[variant=line]/tabs-list:data-active:shadow-none primitive:[&_svg]:pointer-events-none primitive:[&_svg]:shrink-0 primitive:[&_svg:not([class*='size-'])]:size-4",
        'primitive:group-data-[variant=line]/tabs-list:bg-transparent primitive:group-data-[variant=line]/tabs-list:data-active:bg-transparent primitive:dark:group-data-[variant=line]/tabs-list:data-active:border-transparent primitive:dark:group-data-[variant=line]/tabs-list:data-active:bg-transparent',
        'primitive:data-active:bg-background primitive:data-active:text-foreground primitive:dark:data-active:border-input primitive:dark:data-active:bg-input/30 primitive:dark:data-active:text-foreground',
        'primitive:after:absolute primitive:after:bg-foreground primitive:after:opacity-0 primitive:after:transition-opacity primitive:group-data-horizontal/tabs:after:inset-x-0 primitive:group-data-horizontal/tabs:after:bottom-[-5px] primitive:group-data-horizontal/tabs:after:h-0.5 primitive:group-data-vertical/tabs:after:inset-y-0 primitive:group-data-vertical/tabs:after:-right-1 primitive:group-data-vertical/tabs:after:w-0.5 primitive:group-data-[variant=line]/tabs-list:data-active:after:opacity-100',
        className,
      )}
      {...props}
    />
  );
}
