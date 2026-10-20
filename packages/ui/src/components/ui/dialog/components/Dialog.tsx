import { useSurfacePresence } from '@/AppMotion/hooks/useSurfacePresence.ts';
import type { DialogProps } from '@/components/ui/dialog/types.ts';
import { Dialog as DialogPrimitive } from '@base-ui/react/dialog';

export const Dialog = (props: DialogProps) => {
  const surface = useSurfacePresence(props);
  return <DialogPrimitive.Root data-slot="dialog" {...surface} />;
};
