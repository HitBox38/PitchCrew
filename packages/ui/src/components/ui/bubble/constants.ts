import { cva } from 'class-variance-authority';

export const bubbleVariants = cva(
  'group/bubble primitive:relative primitive:flex primitive:w-fit primitive:max-w-[80%] primitive:min-w-0 primitive:flex-col primitive:gap-1 primitive:group-data-[align=end]/message:self-end primitive:data-[align=end]:self-end primitive:data-[variant=ghost]:max-w-full',
  {
    variants: {
      variant: {
        default:
          'primitive:*:data-[slot=bubble-content]:bg-primary primitive:*:data-[slot=bubble-content]:text-primary-foreground primitive:[&>[data-slot=bubble-content]:is(button,a):hover]:bg-primary/80',
        secondary:
          'primitive:*:data-[slot=bubble-content]:bg-secondary primitive:*:data-[slot=bubble-content]:text-secondary-foreground primitive:[&>[data-slot=bubble-content]:is(button,a):hover]:bg-[color-mix(in_oklch,var(--secondary),var(--foreground)_5%)]',
        muted:
          'primitive:*:data-[slot=bubble-content]:bg-muted primitive:[&>[data-slot=bubble-content]:is(button,a):hover]:bg-[color-mix(in_oklch,var(--muted),var(--foreground)_5%)]',
        tinted:
          'primitive:*:data-[slot=bubble-content]:bg-[oklch(from_var(--primary)_0.93_calc(c*0.4)_h)] primitive:*:data-[slot=bubble-content]:text-foreground primitive:dark:*:data-[slot=bubble-content]:bg-[oklch(from_var(--primary)_0.3_calc(c*0.4)_h)] primitive:[&>[data-slot=bubble-content]:is(button,a):hover]:bg-[oklch(from_var(--primary)_0.88_calc(c*0.5)_h)] primitive:dark:[&>[data-slot=bubble-content]:is(button,a):hover]:bg-[oklch(from_var(--primary)_0.35_calc(c*0.5)_h)]',
        outline:
          'primitive:*:data-[slot=bubble-content]:border-border primitive:*:data-[slot=bubble-content]:bg-background primitive:[&>[data-slot=bubble-content]:is(button,a):hover]:bg-muted primitive:[&>[data-slot=bubble-content]:is(button,a):hover]:text-foreground primitive:dark:[&>[data-slot=bubble-content]:is(button,a):hover]:bg-input/30',
        ghost:
          'primitive:border-none primitive:*:data-[slot=bubble-content]:rounded-none primitive:*:data-[slot=bubble-content]:bg-transparent primitive:*:data-[slot=bubble-content]:p-0 primitive:[&>[data-slot=bubble-content]:is(button,a):hover]:bg-muted primitive:[&>[data-slot=bubble-content]:is(button,a):hover]:text-foreground primitive:dark:[&>[data-slot=bubble-content]:is(button,a):hover]:bg-muted/50',
        destructive:
          'primitive:*:data-[slot=bubble-content]:bg-destructive/10 primitive:*:data-[slot=bubble-content]:text-destructive primitive:dark:*:data-[slot=bubble-content]:bg-destructive/20 primitive:[&>[data-slot=bubble-content]:is(button,a):hover]:bg-destructive/20 primitive:dark:[&>[data-slot=bubble-content]:is(button,a):hover]:bg-destructive/30',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
);

export const bubbleReactionsVariants = cva(
  'primitive:absolute primitive:z-10 primitive:flex primitive:w-fit primitive:shrink-0 primitive:items-center primitive:justify-center primitive:gap-1 primitive:rounded-full primitive:bg-muted primitive:px-1.5 primitive:py-0.5 primitive:text-sm primitive:ring-3 primitive:ring-card primitive:has-[button]:p-0',
  {
    variants: {
      side: {
        top: 'primitive:top-0 primitive:-translate-y-3/4',
        bottom: 'primitive:bottom-0 primitive:translate-y-3/4',
      },
      align: {
        start: 'left-3',
        end: 'right-3',
      },
    },
    defaultVariants: {
      side: 'bottom',
      align: 'end',
    },
  },
);
