import type { SkeletonProps } from '@/components/ui/skeleton/types.ts';
import { cn } from '@/lib/utils';

export function Skeleton({ className, ...props }: SkeletonProps) {
  return (
    <div
      data-slot="skeleton"
      className={cn('primitive:animate-pulse primitive:rounded-md primitive:bg-accent', className)}
      {...props}
    />
  );
}
