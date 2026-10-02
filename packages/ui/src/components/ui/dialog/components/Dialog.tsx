import type { DialogProps } from '@/components/ui/dialog/types.ts';
import { Dialog as DialogPrimitive } from '@base-ui/react/dialog';

export function Dialog({ ...props }: DialogProps) {
  return <DialogPrimitive.Root data-slot="dialog" {...props} />;
}
