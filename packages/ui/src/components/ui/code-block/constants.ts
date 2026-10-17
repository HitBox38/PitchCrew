import { cva } from 'class-variance-authority';

export const codeBlockVariants = cva(
  'group/code-block primitive:relative primitive:flex primitive:w-full primitive:min-w-0 primitive:flex-col primitive:overflow-hidden primitive:rounded-lg primitive:text-sm primitive:has-[>[data-slot=code-block-content]:focus-visible]:ring-3 primitive:has-[>[data-slot=code-block-content]:focus-visible]:ring-ring/50 primitive:data-[size=sm]:text-xs',
  {
    variants: {
      variant: {
        default:
          'primitive:border primitive:border-input primitive:text-foreground primitive:has-[>[data-slot=code-block-content]:focus-visible]:border-ring primitive:dark:bg-input/30',
        destructive:
          'primitive:border primitive:border-destructive/30 primitive:text-destructive primitive:dark:border-destructive/40',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
);

export const codeBlockLineVariants = cva(
  "primitive:relative primitive:-mx-4 primitive:block primitive:min-h-lh primitive:px-4 primitive:group-data-[size=sm]/code-block:-mx-3 primitive:group-data-[size=sm]/code-block:px-3 primitive:before:min-w-6 primitive:before:text-end primitive:before:text-muted-foreground primitive:after:absolute primitive:after:start-1 primitive:after:top-0 primitive:after:text-muted-foreground primitive:after:select-none primitive:in-data-numbered:col-span-2 primitive:in-data-numbered:grid primitive:in-data-numbered:grid-cols-subgrid primitive:in-data-numbered:gap-x-3 primitive:in-data-numbered:[counter-increment:line] primitive:in-data-numbered:before:content-[counter(line)] primitive:in-data-numbered:before:select-none primitive:in-data-numbered:supports-[content:counter(line)_/_'']:before:content-[counter(line)_/_'']",
  {
    variants: {
      variant: {
        default: '',
        added: "primitive:bg-muted primitive:after:content-['+']",
        removed:
          "primitive:bg-destructive/10 primitive:after:text-destructive primitive:after:content-['−']",
        highlighted: 'primitive:bg-muted',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
);
