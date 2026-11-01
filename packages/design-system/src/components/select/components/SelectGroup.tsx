import type { SelectGroupProps } from '../types.ts';
import { Select as SelectPrimitive } from '@base-ui/react/select';

export const SelectGroup = ({ ...props }: SelectGroupProps) => {
  return <SelectPrimitive.Group data-slot="select-group" {...props} />;
};
