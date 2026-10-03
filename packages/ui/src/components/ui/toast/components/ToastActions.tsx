import { Button } from '@/components/ui/button/components/Button.tsx';
import { cn } from '@/lib/utils';
import { Toast as ToastPrimitive } from '@base-ui/react/toast';
import { X } from 'lucide-react';

export function ToastAction({
  className,
  render = <Button variant="outline" size="sm" />,
  ...props
}: ToastPrimitive.Action.Props) {
  return (
    <ToastPrimitive.Action
      data-slot="toast-action"
      render={render}
      className={cn('primitive:shrink-0', className)}
      {...props}
    />
  );
}
export function ToastClose({
  className,
  children,
  render = <Button variant="ghost" size="icon-sm" />,
  ...props
}: ToastPrimitive.Close.Props) {
  return (
    <ToastPrimitive.Close
      data-slot="toast-close"
      aria-label="Dismiss notification"
      render={render}
      className={cn('ui-toast-close', className)}
      {...props}
    >
      {children ?? <X size={15} aria-hidden="true" />}
    </ToastPrimitive.Close>
  );
}
