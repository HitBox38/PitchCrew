import type { DialogTriggerProps } from '@/components/ui/dialog/types.ts';
import { Dialog as DialogPrimitive } from '@base-ui/react/dialog';

export function DialogTrigger({ ...props }: DialogTriggerProps) {
  return <DialogPrimitive.Trigger data-slot="dialog-trigger" {...props} />;
}
