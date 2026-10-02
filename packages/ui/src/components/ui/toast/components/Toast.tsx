import { cn } from '@/lib/utils';
import { Toast as ToastPrimitive } from '@base-ui/react/toast';

export function Toast({ className, ...props }: ToastPrimitive.Root.Props) {
  return <ToastPrimitive.Root data-slot="toast" className={cn('ui-toast', className)} {...props} />;
}
