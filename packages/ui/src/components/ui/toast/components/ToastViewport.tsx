import { cn } from '@/lib/utils';
import { Toast as ToastPrimitive } from '@base-ui/react/toast';

export function ToastPortal(props: ToastPrimitive.Portal.Props) {
  return <ToastPrimitive.Portal data-slot="toast-portal" {...props} />;
}
export function ToastViewport({
  className,
  onMouseLeave,
  ...props
}: ToastPrimitive.Viewport.Props) {
  return (
    <ToastPrimitive.Viewport
      data-slot="toast-viewport"
      className={cn('ui-toast-viewport', className)}
      onMouseLeave={(event) => {
        onMouseLeave?.(event);
        const viewport = event.currentTarget;
        const focused = viewport.ownerDocument.activeElement;
        // Base UI 1.8 resumes hover timers even while F6/Tab keeps keyboard focus inside.
        if (
          focused &&
          viewport.contains(focused) &&
          (focused === viewport || focused.matches(':focus-visible'))
        )
          event.preventBaseUIHandler();
      }}
      {...props}
    />
  );
}
