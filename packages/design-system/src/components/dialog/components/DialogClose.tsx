import type { DialogCloseProps } from '../types.ts';
import { Dialog as DialogPrimitive } from '@base-ui/react/dialog';

export const DialogClose = ({ ...props }: DialogCloseProps) => {
  return <DialogPrimitive.Close data-slot="dialog-close" {...props} />;
};
