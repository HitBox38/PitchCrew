import type { SheetTriggerProps } from '@/components/ui/sheet/types.ts';
import { Dialog as SheetPrimitive } from '@base-ui/react/dialog';

export const SheetTrigger = ({ ...props }: SheetTriggerProps) => {
  return <SheetPrimitive.Trigger data-slot="sheet-trigger" {...props} />;
};
