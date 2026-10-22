import { ContextMenuContent } from './ContextMenuContent.tsx';
import type { ContextMenuContentProps } from '../types.ts';
import { cn } from '@/lib/utils';

export const ContextMenuSubContent = ({ className, ...props }: ContextMenuContentProps) => (
  <ContextMenuContent
    data-slot="context-menu-sub-content"
    alignOffset={-3}
    className={cn('primitive:shadow-lg', className)}
    {...props}
  />
);
