import type { CollapsibleContentProps } from '@/components/ui/collapsible/types.ts';
import { Collapsible as CollapsiblePrimitive } from '@base-ui/react/collapsible';

export function CollapsibleContent({ ...props }: CollapsibleContentProps) {
  return <CollapsiblePrimitive.Panel data-slot="collapsible-content" {...props} />;
}
