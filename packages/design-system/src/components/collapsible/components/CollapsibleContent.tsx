import type { CollapsibleContentProps } from '../types.ts';
import { Collapsible as CollapsiblePrimitive } from '@base-ui/react/collapsible';

export const CollapsibleContent = ({ ...props }: CollapsibleContentProps) => {
  return <CollapsiblePrimitive.Panel data-slot="collapsible-content" {...props} />;
};
