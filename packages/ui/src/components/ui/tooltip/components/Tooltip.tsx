import type { TooltipProps } from '@/components/ui/tooltip/types.ts';
import { Tooltip as TooltipPrimitive } from '@base-ui/react/tooltip';

export function Tooltip({ ...props }: TooltipProps) {
  return <TooltipPrimitive.Root data-slot="tooltip" {...props} />;
}
