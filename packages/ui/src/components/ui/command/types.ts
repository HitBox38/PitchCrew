import { Dialog } from '@/components/ui/dialog/components/Dialog.tsx';
import { Command as CommandPrimitive } from 'cmdk';
import * as React from 'react';

export type CommandProps = React.ComponentProps<typeof CommandPrimitive>;
export type CommandDialogProps = Omit<React.ComponentProps<typeof Dialog>, 'children'> & {
  title?: string;
  description?: string;
  className?: string;
  showCloseButton?: boolean;
  children: React.ReactNode;
};

export type CommandEmptyProps = React.ComponentProps<typeof CommandPrimitive.Empty>;

export type CommandGroupProps = React.ComponentProps<typeof CommandPrimitive.Group>;

export type CommandInputProps = React.ComponentProps<typeof CommandPrimitive.Input>;

export type CommandItemProps = React.ComponentProps<typeof CommandPrimitive.Item>;

export type CommandListProps = React.ComponentProps<typeof CommandPrimitive.List>;

export type CommandSeparatorProps = React.ComponentProps<typeof CommandPrimitive.Separator>;

export type CommandShortcutProps = React.ComponentProps<'span'>;
