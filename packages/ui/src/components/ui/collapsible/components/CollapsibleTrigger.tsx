import type { CollapsibleTriggerProps } from '@/components/ui/collapsible/types.ts';
import { Collapsible as CollapsiblePrimitive } from '@base-ui/react/collapsible';

export function CollapsibleTrigger({ ...props }: CollapsibleTriggerProps) {
  return <CollapsiblePrimitive.Trigger data-slot="collapsible-trigger" {...props} />;
}
