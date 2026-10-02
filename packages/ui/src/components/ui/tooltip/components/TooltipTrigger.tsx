import type { TooltipTriggerProps } from '@/components/ui/tooltip/types.ts';
import { Tooltip as TooltipPrimitive } from '@base-ui/react/tooltip';

export function TooltipTrigger({ ...props }: TooltipTriggerProps) {
  return <TooltipPrimitive.Trigger data-slot="tooltip-trigger" {...props} />;
}
