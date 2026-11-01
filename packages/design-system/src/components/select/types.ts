import { Select as SelectPrimitive } from '@base-ui/react/select';
import * as React from 'react';

export type SelectContentProps = SelectPrimitive.Popup.Props &
  Pick<
    SelectPrimitive.Positioner.Props,
    'align' | 'alignOffset' | 'side' | 'sideOffset' | 'alignItemWithTrigger'
  >;

export type SelectGroupProps = SelectPrimitive.Group.Props;

export type SelectItemProps = SelectPrimitive.Item.Props;

export type SelectLabelProps = SelectPrimitive.GroupLabel.Props;
export type SelectScrollDownButtonProps = React.ComponentProps<
  typeof SelectPrimitive.ScrollDownArrow
>;

export type SelectScrollUpButtonProps = React.ComponentProps<typeof SelectPrimitive.ScrollUpArrow>;

export type SelectSeparatorProps = SelectPrimitive.Separator.Props;

export type SelectTriggerProps = SelectPrimitive.Trigger.Props & {
  size?: 'sm' | 'default';
};

export type SelectValueProps = SelectPrimitive.Value.Props;
