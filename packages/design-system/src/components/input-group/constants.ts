import { cva } from 'class-variance-authority';

export const inputGroupAddonVariants = cva(
  "primitive:flex primitive:h-auto primitive:cursor-text primitive:items-center primitive:justify-center primitive:gap-2 primitive:py-1.5 primitive:text-sm primitive:font-medium primitive:text-muted-foreground primitive:select-none primitive:group-data-[disabled=true]/input-group:opacity-50 primitive:[&>kbd]:rounded-[calc(var(--radius)-5px)] primitive:[&>svg:not([class*='size-'])]:size-4",
  {
    variants: {
      align: {
        'inline-start':
          'primitive:order-first primitive:pl-2 primitive:has-[>button]:-ml-1 primitive:has-[>kbd]:ml-[-0.15rem]',
        'inline-end':
          'primitive:order-last primitive:pr-2 primitive:has-[>button]:-mr-1 primitive:has-[>kbd]:mr-[-0.15rem]',
        'block-start':
          'primitive:order-first primitive:w-full primitive:justify-start primitive:px-2.5 primitive:pt-2 primitive:group-has-[>input]/input-group:pt-2 primitive:[.border-b]:pb-2',
        'block-end':
          'primitive:order-last primitive:w-full primitive:justify-start primitive:px-2.5 primitive:pb-2 primitive:group-has-[>input]/input-group:pb-2 primitive:[.border-t]:pt-2',
      },
    },
    defaultVariants: {
      align: 'inline-start',
    },
  },
);

export const inputGroupButtonVariants = cva(
  'primitive:flex primitive:items-center primitive:gap-2 primitive:text-sm primitive:shadow-none',
  {
    variants: {
      size: {
        xs: "primitive:h-6 primitive:gap-1 primitive:rounded-[calc(var(--radius)-5px)] primitive:px-1.5 primitive:[&>svg:not([class*='size-'])]:size-3.5",
        sm: '',
        'icon-xs':
          'primitive:size-6 primitive:rounded-[calc(var(--radius)-5px)] primitive:p-0 primitive:has-[>svg]:p-0',
        'icon-sm': 'primitive:size-8 primitive:p-0 primitive:has-[>svg]:p-0',
      },
    },
    defaultVariants: {
      size: 'xs',
    },
  },
);
