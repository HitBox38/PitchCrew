import type { DialogPortalProps } from '@/components/ui/dialog/types.ts';
import { Dialog as DialogPrimitive } from '@base-ui/react/dialog';

export function DialogPortal({ ...props }: DialogPortalProps) {
  return <DialogPrimitive.Portal data-slot="dialog-portal" {...props} />;
}
