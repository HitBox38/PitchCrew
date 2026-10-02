import type { SelectGroupProps } from '@/components/ui/select/types.ts';
import { Select as SelectPrimitive } from '@base-ui/react/select';

export function SelectGroup({ ...props }: SelectGroupProps) {
  return <SelectPrimitive.Group data-slot="select-group" {...props} />;
}
