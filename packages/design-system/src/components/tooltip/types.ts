import { Tooltip as TooltipPrimitive } from '@base-ui/react/tooltip';

export type TooltipProps = TooltipPrimitive.Root.Props;

export type TooltipContentProps = TooltipPrimitive.Popup.Props &
  Pick<TooltipPrimitive.Positioner.Props, 'align' | 'alignOffset' | 'side' | 'sideOffset'>;

export type TooltipProviderProps = TooltipPrimitive.Provider.Props;

export type TooltipTriggerProps = TooltipPrimitive.Trigger.Props;
