import type { CollapsibleProps } from '@/components/ui/collapsible/types.ts';
import { Collapsible as CollapsiblePrimitive } from '@base-ui/react/collapsible';

export function Collapsible({ ...props }: CollapsibleProps) {
  return <CollapsiblePrimitive.Root data-slot="collapsible" {...props} />;
}
