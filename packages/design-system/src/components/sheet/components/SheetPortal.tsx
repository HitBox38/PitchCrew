import type { SheetPortalProps } from '../types.ts';
import { Dialog as SheetPrimitive } from '@base-ui/react/dialog';

export const SheetPortal = ({ ...props }: SheetPortalProps) => {
  return <SheetPrimitive.Portal data-slot="sheet-portal" {...props} />;
};
