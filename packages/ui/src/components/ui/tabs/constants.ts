import { cva } from 'class-variance-authority';

export const tabsListVariants = cva(
  'group/tabs-list primitive:inline-flex primitive:w-fit primitive:items-center primitive:justify-center primitive:rounded-lg primitive:p-[3px] primitive:text-muted-foreground primitive:group-data-horizontal/tabs:h-9 primitive:group-data-vertical/tabs:h-fit primitive:group-data-vertical/tabs:flex-col primitive:data-[variant=line]:rounded-none',
  {
    variants: {
      variant: {
        default: 'primitive:bg-muted',
        line: 'primitive:gap-1 primitive:bg-transparent',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
);
