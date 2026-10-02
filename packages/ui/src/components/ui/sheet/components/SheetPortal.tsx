import type { SheetPortalProps } from '@/components/ui/sheet/types.ts';
import { Dialog as SheetPrimitive } from '@base-ui/react/dialog';

export function SheetPortal({ ...props }: SheetPortalProps) {
  return <SheetPrimitive.Portal data-slot="sheet-portal" {...props} />;
}
