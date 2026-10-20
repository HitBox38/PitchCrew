import type { ComponentProps } from 'react';
import { Button } from '@/components/ui/button/components/Button.tsx';
import { cn } from '@/lib/utils.ts';

export const Suggestions = ({ className, ...props }: ComponentProps<'div'>) => {
  return (
    <div
      className={cn(
        'primitive:flex primitive:gap-2 primitive:overflow-x-auto primitive:overscroll-x-contain',
        className,
      )}
      {...props}
    />
  );
};
export const Suggestion = ({
  suggestion,
  onClick,
  className,
  ...props
}: Omit<ComponentProps<typeof Button>, 'onClick'> & {
  suggestion: string;
  onClick: (suggestion: string) => void;
}) => {
  return (
    <Button
      variant="outline"
      size="sm"
      className={cn('primitive:shrink-0', className)}
      onClick={() => onClick(suggestion)}
      {...props}
    />
  );
};
