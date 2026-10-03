import { cva } from 'class-variance-authority';

export const buttonVariants = cva(
  "primitive:inline-flex primitive:shrink-0 primitive:items-center primitive:justify-center primitive:gap-2 primitive:rounded-md primitive:text-sm primitive:font-medium primitive:whitespace-nowrap primitive:transition-all primitive:outline-none primitive:focus-visible:border-ring primitive:focus-visible:ring-[3px] primitive:focus-visible:ring-ring/50 primitive:disabled:pointer-events-none primitive:disabled:opacity-50 primitive:aria-invalid:border-destructive primitive:aria-invalid:ring-destructive/20 primitive:dark:aria-invalid:ring-destructive/40 primitive:[&_svg]:pointer-events-none primitive:[&_svg]:shrink-0 primitive:[&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default:
          'primitive:bg-primary primitive:text-primary-foreground primitive:hover:bg-primary/90',
        destructive:
          'primitive:bg-destructive primitive:text-white primitive:hover:bg-destructive/90 primitive:focus-visible:ring-destructive/20 primitive:dark:bg-destructive/60 primitive:dark:focus-visible:ring-destructive/40',
        outline:
          'primitive:border primitive:bg-background primitive:shadow-xs primitive:hover:bg-accent primitive:hover:text-accent-foreground primitive:dark:border-input primitive:dark:bg-input/30 primitive:dark:hover:bg-input/50',
        secondary:
          'primitive:bg-secondary primitive:text-secondary-foreground primitive:hover:bg-secondary/80',
        ghost:
          'primitive:hover:bg-accent primitive:hover:text-accent-foreground primitive:dark:hover:bg-accent/50',
        link: 'primitive:text-primary primitive:underline-offset-4 primitive:hover:underline',
      },
      size: {
        default: 'primitive:h-9 primitive:px-4 primitive:py-2 primitive:has-[>svg]:px-3',
        xs: "primitive:h-6 primitive:gap-1 primitive:rounded-md primitive:px-2 primitive:text-xs primitive:has-[>svg]:px-1.5 primitive:[&_svg:not([class*='size-'])]:size-3",
        sm: 'primitive:h-8 primitive:gap-1.5 primitive:rounded-md primitive:px-3 primitive:has-[>svg]:px-2.5',
        lg: 'primitive:h-10 primitive:rounded-md primitive:px-6 primitive:has-[>svg]:px-4',
        icon: 'primitive:size-9',
        'icon-xs':
          "primitive:size-6 primitive:rounded-md primitive:[&_svg:not([class*='size-'])]:size-3",
        'icon-sm': 'primitive:size-8',
        'icon-lg': 'primitive:size-10',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
);
