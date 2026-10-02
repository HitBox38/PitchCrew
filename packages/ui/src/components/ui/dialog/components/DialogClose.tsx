import type { DialogCloseProps } from '@/components/ui/dialog/types.ts';
import { Dialog as DialogPrimitive } from '@base-ui/react/dialog';

export function DialogClose({ ...props }: DialogCloseProps) {
  return <DialogPrimitive.Close data-slot="dialog-close" {...props} />;
}
