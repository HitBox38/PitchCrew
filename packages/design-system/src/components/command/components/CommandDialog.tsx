import { Command } from './Command.tsx';
import type { CommandDialogProps } from '../types.ts';
import { Dialog } from '../../dialog/components/Dialog.tsx';
import { DialogContent } from '../../dialog/components/DialogContent.tsx';
import { DialogDescription } from '../../dialog/components/DialogDescription.tsx';
import { DialogHeader } from '../../dialog/components/DialogHeader.tsx';
import { DialogTitle } from '../../dialog/components/DialogTitle.tsx';
import { cn } from '../../../lib/utils.ts';

export const CommandDialog = ({
  title = 'Command Palette',
  description = 'Search for a command to run...',
  children,
  className,
  showCloseButton = true,
  commandProps,
  ...props
}: CommandDialogProps) => {
  return (
    <Dialog {...props}>
      <DialogHeader className="primitive:sr-only">
        <DialogTitle>{title}</DialogTitle>
        <DialogDescription>{description}</DialogDescription>
      </DialogHeader>
      <DialogContent
        motion={false}
        className={cn('primitive:overflow-hidden primitive:p-0', className)}
        showCloseButton={showCloseButton}
      >
        <Command
          {...commandProps}
          className="primitive:**:data-[slot=command-input-wrapper]:h-12 primitive:[&_[cmdk-group-heading]]:px-2 primitive:[&_[cmdk-group-heading]]:font-medium primitive:[&_[cmdk-group-heading]]:text-muted-foreground primitive:[&_[cmdk-group]]:px-2 primitive:[&_[cmdk-group]:not([hidden])_~[cmdk-group]]:pt-0 primitive:[&_[cmdk-input-wrapper]_svg]:h-5 primitive:[&_[cmdk-input-wrapper]_svg]:w-5 primitive:[&_[cmdk-input]]:h-12 primitive:[&_[cmdk-item]]:px-2 primitive:[&_[cmdk-item]]:py-3 primitive:[&_[cmdk-item]_svg]:h-5 primitive:[&_[cmdk-item]_svg]:w-5"
        >
          {children}
        </Command>
      </DialogContent>
    </Dialog>
  );
};
