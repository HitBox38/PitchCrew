import type { TooltipProviderProps } from '@/components/ui/tooltip/types.ts';
import { Tooltip as TooltipPrimitive } from '@base-ui/react/tooltip';

export function TooltipProvider({ delay = 0, ...props }: TooltipProviderProps) {
  return <TooltipPrimitive.Provider data-slot="tooltip-provider" delay={delay} {...props} />;
}
