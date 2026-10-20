import { cva } from 'class-variance-authority';

export const attachmentVariants = cva(
  'group/attachment primitive:relative primitive:flex primitive:w-fit primitive:max-w-full primitive:min-w-0 primitive:shrink-0 primitive:flex-wrap primitive:rounded-[10px_11px_10px_9px] primitive:border-0 primitive:text-card-foreground primitive:shadow-clay primitive:transition-[background,box-shadow] primitive:[background:var(--clay-fill)] primitive:focus-within:ring-1 primitive:focus-within:ring-ring/50 primitive:has-[>a,>button]:hover:shadow-clay-hover primitive:has-[>a,>button]:hover:[background:var(--clay-fill-hover)] primitive:data-[state=error]:border primitive:data-[state=error]:border-destructive/30 primitive:data-[state=idle]:border primitive:data-[state=idle]:border-dashed primitive:data-[state=idle]:border-[var(--border-strong)]',
  {
    variants: {
      size: {
        default:
          'primitive:gap-2 primitive:text-sm primitive:has-data-[slot=attachment-content]:px-2.5 primitive:has-data-[slot=attachment-content]:py-2 primitive:has-data-[slot=attachment-media]:p-2',
        sm: 'primitive:gap-2.5 primitive:text-xs primitive:has-data-[slot=attachment-content]:px-2 primitive:has-data-[slot=attachment-content]:py-1.5 primitive:has-data-[slot=attachment-media]:p-1.5',
        xs: 'primitive:gap-1.5 primitive:rounded-lg primitive:text-xs primitive:has-data-[slot=attachment-content]:px-1.5 primitive:has-data-[slot=attachment-content]:py-1 primitive:has-data-[slot=attachment-media]:p-1',
      },
      orientation: {
        horizontal: 'primitive:min-w-40 primitive:items-center',
        vertical:
          'primitive:w-24 primitive:flex-col primitive:has-data-[slot=attachment-content]:w-30',
      },
    },
  },
);

export const attachmentMediaVariants = cva(
  "primitive:relative primitive:flex primitive:aspect-square primitive:w-10 primitive:shrink-0 primitive:items-center primitive:justify-center primitive:overflow-hidden primitive:rounded-lg primitive:bg-muted primitive:text-foreground primitive:group-data-[orientation=vertical]/attachment:w-full primitive:group-data-[size=sm]/attachment:w-8 primitive:group-data-[size=xs]/attachment:w-7 primitive:group-data-[size=xs]/attachment:rounded-md primitive:group-data-[state=error]/attachment:bg-destructive/10 primitive:group-data-[state=error]/attachment:text-destructive primitive:group-data-[orientation=vertical]/attachment:*:data-[slot=spinner]:size-6! primitive:[&_svg]:pointer-events-none primitive:[&_svg:not([class*='size-'])]:size-4 primitive:group-data-[orientation=vertical]/attachment:[&_svg:not([class*='size-'])]:size-6 primitive:group-data-[size=xs]/attachment:[&_svg:not([class*='size-'])]:size-3.5",
  {
    variants: {
      variant: {
        icon: '',
        image:
          'primitive:opacity-60 primitive:group-data-[state=done]/attachment:opacity-100 primitive:group-data-[state=idle]/attachment:opacity-100 primitive:*:[img]:aspect-square primitive:*:[img]:w-full primitive:*:[img]:object-cover',
      },
    },
    defaultVariants: {
      variant: 'icon',
    },
  },
);
