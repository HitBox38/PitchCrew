import { badgeVariants } from '@/components/ui/badge/constants.ts';
import type { BadgeProps } from '@/components/ui/badge/types.ts';
import { cn } from '@/lib/utils';
import { mergeProps } from '@base-ui/react/merge-props';
import { useRender } from '@base-ui/react/use-render';

export function Badge({ className, variant = 'default', render, ...props }: BadgeProps) {
  return useRender({
    defaultTagName: 'span',
    props: mergeProps<'span'>({ className: cn(badgeVariants({ variant }), className) }, props),
    render,
    state: {
      slot: 'badge',
      variant,
    },
  });
}
