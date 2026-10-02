import { cn } from '@/lib/utils';
import { Toast as ToastPrimitive } from '@base-ui/react/toast';

export function ToastContent({ className, ...props }: ToastPrimitive.Content.Props) {
  return (
    <ToastPrimitive.Content
      data-slot="toast-content"
      className={cn('ui-toast-content', className)}
      {...props}
    />
  );
}
export function ToastTitle({ className, ...props }: ToastPrimitive.Title.Props) {
  return (
    <ToastPrimitive.Title
      data-slot="toast-title"
      className={cn('ui-toast-title', className)}
      {...props}
    />
  );
}
export function ToastDescription({ className, ...props }: ToastPrimitive.Description.Props) {
  return (
    <ToastPrimitive.Description
      data-slot="toast-description"
      className={cn('ui-toast-description', className)}
      {...props}
    />
  );
}
