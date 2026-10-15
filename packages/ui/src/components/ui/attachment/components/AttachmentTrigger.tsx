import { cn } from '@/lib/utils.ts';
import { mergeProps } from '@base-ui/react/merge-props';
import { useRender } from '@base-ui/react/use-render';

export function AttachmentTrigger({
  className,
  render,
  type,
  ...props
}: useRender.ComponentProps<'button'>) {
  return useRender({
    defaultTagName: 'button',
    props: mergeProps<'button'>(
      {
        type: render ? type : (type ?? 'button'),
        className: cn(
          'primitive:absolute primitive:inset-0 primitive:z-10 primitive:outline-none',
          className,
        ),
      },
      props,
    ),
    render,
    state: {
      slot: 'attachment-trigger',
    },
  });
}
