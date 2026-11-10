import * as React from 'react';
import { cn } from '../../../lib/utils.ts';
import { messagePresence } from '../presence.ts';

export const Message = ({
  className,
  align = 'start',
  ...props
}: React.ComponentProps<'div'> & { align?: 'start' | 'end' }) => {
  const { Provider, register, attributes } = messagePresence.useRoot();
  return (
    <Provider value={register}>
      <div
        data-slot="message"
        data-align={align}
        {...attributes}
        className={cn(
          'group/message primitive:relative primitive:flex primitive:w-full primitive:min-w-0 primitive:gap-2 primitive:text-sm primitive:data-[align=end]:flex-row-reverse',
          className,
        )}
        {...props}
      />
    </Provider>
  );
};
