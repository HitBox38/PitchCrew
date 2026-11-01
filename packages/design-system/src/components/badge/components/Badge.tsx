import { badgeVariants } from '../constants.ts';
import type { BadgeProps } from '../types.ts';
import { cn } from '../../../lib/utils.ts';
import { mergeProps } from '@base-ui/react/merge-props';
import { useRender } from '@base-ui/react/use-render';

export const Badge = ({ className, variant = 'default', render, ...props }: BadgeProps) => {
  return useRender({
    defaultTagName: 'span',
    props: mergeProps<'span'>({ className: cn(badgeVariants({ variant }), className) }, props),
    render,
    state: {
      slot: 'badge',
      variant,
    },
  });
};
