import { useSurfacePresence } from '../../../hooks/useSurfacePresence.ts';
import type { DialogProps } from '../types.ts';
import { Dialog as DialogPrimitive } from '@base-ui/react/dialog';

export const Dialog = (props: DialogProps) => {
  const surface = useSurfacePresence(props);
  return <DialogPrimitive.Root data-slot="dialog" {...surface} />;
};
