import type { SkeletonProps } from '@/components/ui/skeleton/types.ts';
import { cn } from '@/lib/utils';

export function Skeleton({ className, ...props }: SkeletonProps) {
  return (
    <div
      data-slot="skeleton"
      className={cn('animate-pulse rounded-md bg-accent', className)}
      {...props}
    />
  );
}
