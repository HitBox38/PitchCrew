import { ContextMenu as ContextMenuPrimitive } from '@base-ui/react/context-menu';

export type ContextMenuProps = ContextMenuPrimitive.Root.Props;
export type ContextMenuTriggerProps = ContextMenuPrimitive.Trigger.Props;
export type ContextMenuContentProps = ContextMenuPrimitive.Popup.Props &
  Pick<ContextMenuPrimitive.Positioner.Props, 'align' | 'alignOffset' | 'side' | 'sideOffset'>;
