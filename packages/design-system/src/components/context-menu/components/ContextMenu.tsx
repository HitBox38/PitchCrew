import { ContextMenu as ContextMenuPrimitive } from '@base-ui/react/context-menu';
import type { ContextMenuProps } from '../types.ts';

export const ContextMenu = (props: ContextMenuProps) => (
  <ContextMenuPrimitive.Root data-slot="context-menu" {...props} />
);
