import { useSurfacePresence } from '@/AppMotion/hooks/useSurfacePresence.ts';
import type { SheetProps } from '@/components/ui/sheet/types.ts';
import { Dialog as DialogPrimitive } from '@base-ui/react/dialog';

export function Sheet(props: SheetProps) {
  const surface = useSurfacePresence(props);
  return <DialogPrimitive.Root data-slot="sheet" {...surface} />;
}
