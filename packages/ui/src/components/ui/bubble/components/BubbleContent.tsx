import { cn } from '@/lib/utils.ts';
import { mergeProps } from '@base-ui/react/merge-props';
import { useRender } from '@base-ui/react/use-render';

export function BubbleContent({ className, render, ...props }: useRender.ComponentProps<'div'>) {
  return useRender({
    defaultTagName: 'div',
    props: mergeProps<'div'>(
      {
        className: cn(
          'primitive:w-fit primitive:max-w-full primitive:min-w-0 primitive:overflow-hidden primitive:rounded-xl primitive:border primitive:border-transparent primitive:px-3 primitive:py-2 primitive:text-sm primitive:leading-relaxed primitive:wrap-break-word primitive:group-data-[align=end]/bubble:self-end primitive:[button]:text-left primitive:[button,a]:transition-colors primitive:[button,a]:outline-none primitive:[button,a]:focus-visible:border-ring primitive:[button,a]:focus-visible:ring-3 primitive:[button,a]:focus-visible:ring-ring/50',
          className,
        ),
      },
      props,
    ),
    render,
    state: {
      slot: 'bubble-content',
    },
  });
}
