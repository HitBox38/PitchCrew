import type { SheetProps } from '@/components/ui/sheet/types.ts';
import { Dialog as SheetPrimitive } from '@base-ui/react/dialog';

export function Sheet({ ...props }: SheetProps) {
  return <SheetPrimitive.Root data-slot="sheet" {...props} />;
}
