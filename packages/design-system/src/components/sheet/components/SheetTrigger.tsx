import type { SheetTriggerProps } from '../types.ts';
import { Dialog as SheetPrimitive } from '@base-ui/react/dialog';

export const SheetTrigger = ({ ...props }: SheetTriggerProps) => {
  return <SheetPrimitive.Trigger data-slot="sheet-trigger" {...props} />;
};
