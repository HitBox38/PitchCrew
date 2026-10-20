import * as React from 'react';
import { cn } from '@/lib/utils.ts';
import { Button } from '@/components/ui/button/components/Button.tsx';
import { MessageScroller as MessageScrollerPrimitive } from '@shadcn/react/message-scroller';
import { ArrowDownIcon } from 'lucide-react';

export const MessageScrollerButton = ({
  direction = 'end',
  className,
  children,
  render,
  variant = 'secondary',
  size = 'icon-sm',
  ...props
}: React.ComponentProps<typeof MessageScrollerPrimitive.Button> &
  Pick<React.ComponentProps<typeof Button>, 'variant' | 'size'>) => {
  return (
    <MessageScrollerPrimitive.Button
      data-slot="message-scroller-button"
      data-direction={direction}
      data-variant={variant}
      data-size={size}
      direction={direction}
      className={cn(
        'primitive:absolute primitive:inset-s-1/2 primitive:-translate-x-1/2 primitive:border-border primitive:bg-background primitive:text-foreground primitive:transition-[translate,scale,opacity] primitive:duration-200 primitive:hover:bg-muted primitive:hover:text-foreground primitive:data-[active=false]:pointer-events-none primitive:data-[active=false]:scale-95 primitive:data-[active=false]:opacity-0 primitive:data-[active=false]:duration-400 primitive:data-[active=false]:ease-[cubic-bezier(0.7,0,0.84,0)] primitive:data-[active=true]:translate-y-0 primitive:data-[active=true]:scale-100 primitive:data-[active=true]:opacity-100 primitive:data-[active=true]:ease-[cubic-bezier(0.23,1,0.32,1)] primitive:data-[direction=end]:bottom-4 primitive:data-[direction=end]:data-[active=false]:translate-y-full primitive:data-[direction=start]:top-4 primitive:data-[direction=start]:data-[active=false]:-translate-y-full primitive:rtl:translate-x-1/2 primitive:data-[direction=start]:[&_svg]:rotate-180',
        className,
      )}
      render={render ?? <Button variant={variant} size={size} />}
      {...props}
    >
      {children ?? (
        <>
          <ArrowDownIcon />
          <span className="primitive:sr-only">
            {direction === 'end' ? 'Scroll to end' : 'Scroll to start'}
          </span>
        </>
      )}
    </MessageScrollerPrimitive.Button>
  );
};
