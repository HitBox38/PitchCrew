import type { DialogPortalProps } from '../types.ts';
import { Dialog as DialogPrimitive } from '@base-ui/react/dialog';

export const DialogPortal = ({ ...props }: DialogPortalProps) => {
  return <DialogPrimitive.Portal data-slot="dialog-portal" {...props} />;
};
