import type { SelectValueProps } from '@/components/ui/select/types.ts';
import { Select as SelectPrimitive } from '@base-ui/react/select';

export const SelectValue = ({ ...props }: SelectValueProps) => {
  return <SelectPrimitive.Value data-slot="select-value" {...props} />;
};
