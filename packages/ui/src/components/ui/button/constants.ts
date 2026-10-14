import { cva } from 'class-variance-authority';

export const buttonVariants = cva(
  "primitive:inline-flex primitive:shrink-0 primitive:items-center primitive:justify-center primitive:gap-[7px] primitive:rounded-[11px_12px_11px_10px] primitive:border-0 primitive:text-label primitive:font-semibold primitive:whitespace-nowrap primitive:transition-[color,background,box-shadow,opacity] primitive:outline-none primitive:disabled:pointer-events-none primitive:disabled:opacity-50 primitive:data-disabled:pointer-events-none primitive:data-disabled:opacity-50 primitive:[&_svg]:pointer-events-none primitive:[&_svg]:shrink-0 primitive:[&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default:
          'primitive:text-primary-foreground primitive:shadow-glaze primitive:[background:var(--glaze-fill)] primitive:hover:[background:var(--glaze-fill-hover)] primitive:active:shadow-[var(--glaze-pressed)]',
        destructive:
          'primitive:text-destructive primitive:shadow-clay primitive:[background:var(--clay-fill)] primitive:hover:text-(--error-ink) primitive:hover:shadow-clay-hover primitive:hover:[background:var(--clay-fill-hover)] primitive:active:shadow-sunken',
        outline:
          'primitive:text-foreground primitive:shadow-clay primitive:[background:var(--clay-fill)] primitive:hover:shadow-clay-hover primitive:hover:[background:var(--clay-fill-hover)] primitive:active:shadow-sunken',
        secondary:
          'primitive:text-secondary-foreground primitive:shadow-clay primitive:[background:var(--clay-fill)] primitive:hover:shadow-clay-hover primitive:hover:[background:var(--clay-fill-hover)] primitive:active:shadow-sunken',
        ghost:
          'primitive:bg-transparent primitive:text-muted-foreground primitive:shadow-none primitive:hover:bg-[rgb(var(--tint)/0.06)] primitive:hover:text-foreground',
        link: 'primitive:bg-transparent primitive:text-primary primitive:underline-offset-[3px] primitive:shadow-none primitive:hover:text-(--primary-deep) primitive:hover:underline',
      },
      size: {
        default: 'primitive:h-[38px] primitive:px-[15px] primitive:py-0',
        xs: "primitive:h-6 primitive:gap-1 primitive:rounded-[7px_8px_7px_6px] primitive:px-2 primitive:py-0 primitive:text-xs primitive:has-[>svg]:px-1.5 primitive:[&_svg:not([class*='size-'])]:size-3",
        sm: 'primitive:h-8 primitive:gap-1.5 primitive:rounded-[9px_10px_9px_8px] primitive:px-3 primitive:py-0 primitive:text-xs',
        lg: 'primitive:h-10 primitive:px-6 primitive:py-0',
        icon: 'primitive:size-[38px] primitive:p-0',
        'icon-xs':
          "primitive:size-6 primitive:rounded-[7px_8px_7px_6px] primitive:p-0 primitive:[&_svg:not([class*='size-'])]:size-3",
        'icon-sm': 'primitive:size-8 primitive:rounded-[9px_10px_9px_8px] primitive:p-0',
        'icon-lg': 'primitive:size-10 primitive:p-0',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
);
