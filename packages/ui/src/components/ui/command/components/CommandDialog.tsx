import { Command } from '@/components/ui/command/components/Command.tsx';
import type { CommandDialogProps } from '@/components/ui/command/types.ts';
import { Dialog } from '@/components/ui/dialog/components/Dialog.tsx';
import { DialogContent } from '@/components/ui/dialog/components/DialogContent.tsx';
import { DialogDescription } from '@/components/ui/dialog/components/DialogDescription.tsx';
import { DialogHeader } from '@/components/ui/dialog/components/DialogHeader.tsx';
import { DialogTitle } from '@/components/ui/dialog/components/DialogTitle.tsx';
import { cn } from '@/lib/utils';

export function CommandDialog({
  title = 'Command Palette',
  description = 'Search for a command to run...',
  children,
  className,
  showCloseButton = true,
  ...props
}: CommandDialogProps) {
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
        <Command className="primitive:**:data-[slot=command-input-wrapper]:h-12 primitive:[&_[cmdk-group-heading]]:px-2 primitive:[&_[cmdk-group-heading]]:font-medium primitive:[&_[cmdk-group-heading]]:text-muted-foreground primitive:[&_[cmdk-group]]:px-2 primitive:[&_[cmdk-group]:not([hidden])_~[cmdk-group]]:pt-0 primitive:[&_[cmdk-input-wrapper]_svg]:h-5 primitive:[&_[cmdk-input-wrapper]_svg]:w-5 primitive:[&_[cmdk-input]]:h-12 primitive:[&_[cmdk-item]]:px-2 primitive:[&_[cmdk-item]]:py-3 primitive:[&_[cmdk-item]_svg]:h-5 primitive:[&_[cmdk-item]_svg]:w-5">
          {children}
        </Command>
      </DialogContent>
    </Dialog>
  );
}
