import { useSurfacePresence } from '../../../hooks/useSurfacePresence.ts';
import type { SheetProps } from '../types.ts';
import { Dialog as DialogPrimitive } from '@base-ui/react/dialog';

export const Sheet = (props: SheetProps) => {
  const surface = useSurfacePresence(props);
  return <DialogPrimitive.Root data-slot="sheet" {...surface} />;
};
