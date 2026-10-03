import { Dialog as DialogPrimitive } from '@base-ui/react/dialog';
import * as React from 'react';

export type DialogProps = DialogPrimitive.Root.Props;

export type DialogCloseProps = DialogPrimitive.Close.Props;

export type DialogContentProps = DialogPrimitive.Popup.Props & {
  showCloseButton?: boolean;
  motion?: boolean;
};

export type DialogDescriptionProps = DialogPrimitive.Description.Props;
export type DialogFooterProps = React.ComponentProps<'div'> & {
  showCloseButton?: boolean;
};

export type DialogHeaderProps = React.ComponentProps<'div'>;

export type DialogOverlayProps = DialogPrimitive.Backdrop.Props;

export type DialogPortalProps = DialogPrimitive.Portal.Props;

export type DialogTitleProps = DialogPrimitive.Title.Props;

export type DialogTriggerProps = DialogPrimitive.Trigger.Props;
