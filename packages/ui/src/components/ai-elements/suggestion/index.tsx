import type { ComponentProps } from 'react';
import { Button } from '@pitchcrew/design-system/button';
import { cn } from '@pitchcrew/design-system/utils';

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
