import type { CollapsibleProps } from '../types.ts';
import { Collapsible as CollapsiblePrimitive } from '@base-ui/react/collapsible';

export const Collapsible = ({ ...props }: CollapsibleProps) => {
  return <CollapsiblePrimitive.Root data-slot="collapsible" {...props} />;
};
