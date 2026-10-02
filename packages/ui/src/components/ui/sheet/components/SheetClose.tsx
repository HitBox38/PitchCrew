import type { SheetCloseProps } from '@/components/ui/sheet/types.ts';
import { Dialog as SheetPrimitive } from '@base-ui/react/dialog';

export function SheetClose({ ...props }: SheetCloseProps) {
  return <SheetPrimitive.Close data-slot="sheet-close" {...props} />;
}
