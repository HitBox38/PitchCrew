import type { CollapsibleTriggerProps } from '../types.ts';
import { Collapsible as CollapsiblePrimitive } from '@base-ui/react/collapsible';

export const CollapsibleTrigger = ({ ...props }: CollapsibleTriggerProps) => {
  return <CollapsiblePrimitive.Trigger data-slot="collapsible-trigger" {...props} />;
};
