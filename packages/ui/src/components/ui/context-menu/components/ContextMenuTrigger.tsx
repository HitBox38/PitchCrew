import { ContextMenu as ContextMenuPrimitive } from '@base-ui/react/context-menu';
import type { ContextMenuTriggerProps } from '../types.ts';

export const ContextMenuTrigger = (props: ContextMenuTriggerProps) => (
  <ContextMenuPrimitive.Trigger data-slot="context-menu-trigger" {...props} />
);
