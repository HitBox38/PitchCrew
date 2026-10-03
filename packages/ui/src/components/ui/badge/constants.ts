import { cva } from 'class-variance-authority';

export const badgeVariants = cva(
  'primitive:inline-flex primitive:w-fit primitive:shrink-0 primitive:items-center primitive:justify-center primitive:gap-1 primitive:overflow-hidden primitive:rounded-full primitive:border primitive:border-transparent primitive:px-2 primitive:py-0.5 primitive:text-xs primitive:font-medium primitive:whitespace-nowrap primitive:transition-[color,box-shadow] primitive:focus-visible:border-ring primitive:focus-visible:ring-[3px] primitive:focus-visible:ring-ring/50 primitive:aria-invalid:border-destructive primitive:aria-invalid:ring-destructive/20 primitive:dark:aria-invalid:ring-destructive/40 primitive:[&>svg]:pointer-events-none primitive:[&>svg]:size-3',
  {
    variants: {
      variant: {
        default:
          'primitive:bg-primary primitive:text-primary-foreground primitive:[a&]:hover:bg-primary/90',
        secondary:
          'primitive:bg-secondary primitive:text-secondary-foreground primitive:[a&]:hover:bg-secondary/90',
        destructive:
          'primitive:bg-destructive primitive:text-white primitive:focus-visible:ring-destructive/20 primitive:dark:bg-destructive/60 primitive:dark:focus-visible:ring-destructive/40 primitive:[a&]:hover:bg-destructive/90',
        outline:
          'primitive:border-border primitive:text-foreground primitive:[a&]:hover:bg-accent primitive:[a&]:hover:text-accent-foreground',
        ghost: 'primitive:[a&]:hover:bg-accent primitive:[a&]:hover:text-accent-foreground',
        link: 'primitive:text-primary primitive:underline-offset-4 primitive:[a&]:hover:underline',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
);
