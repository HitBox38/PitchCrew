import { Dialog as SheetPrimitive } from '@base-ui/react/dialog';
import * as React from 'react';

export type SheetProps = SheetPrimitive.Root.Props;

export type SheetContentProps = SheetPrimitive.Popup.Props & {
  side?: 'top' | 'right' | 'bottom' | 'left';
  showCloseButton?: boolean;
};

export type SheetDescriptionProps = SheetPrimitive.Description.Props;
export type SheetHeaderProps = React.ComponentProps<'div'>;

export type SheetOverlayProps = SheetPrimitive.Backdrop.Props;

export type SheetPortalProps = SheetPrimitive.Portal.Props;

export type SheetTitleProps = SheetPrimitive.Title.Props;
