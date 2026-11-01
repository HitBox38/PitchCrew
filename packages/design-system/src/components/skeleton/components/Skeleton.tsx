import type { SkeletonProps } from '../types.ts';
import { cn } from '../../../lib/utils.ts';

export const Skeleton = ({ className, ...props }: SkeletonProps) => {
  return (
    <div
      data-slot="skeleton"
      className={cn('primitive:animate-pulse primitive:rounded-md primitive:bg-accent', className)}
      {...props}
    />
  );
};
