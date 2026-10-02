import { cn } from '@/lib/utils';
import { Toast as ToastPrimitive } from '@base-ui/react/toast';

export function ToastPortal(props: ToastPrimitive.Portal.Props) {
  return <ToastPrimitive.Portal data-slot="toast-portal" {...props} />;
}
export function ToastViewport({ className, ...props }: ToastPrimitive.Viewport.Props) {
  return (
    <ToastPrimitive.Viewport
      data-slot="toast-viewport"
      className={cn('ui-toast-viewport', className)}
      {...props}
    />
  );
}
