import { MoreHorizontal, Unlink } from 'lucide-react';
import { Button } from '@pitchcrew/design-system/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@pitchcrew/design-system/dropdown-menu';

export const SourceMenu = ({
  label,
  disabled,
  remove,
}: {
  label: string;
  disabled: boolean;
  remove: () => void;
}) => {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={<Button variant="ghost" size="icon" className="size-8 shrink-0" />}
        aria-label={`Actions for ${label}`}
        disabled={disabled}
      >
        <MoreHorizontal size={17} />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuItem variant="destructive" onClick={remove}>
          <Unlink size={15} /> Remove source
        </DropdownMenuItem>
        <p className="px-2 py-1.5 text-xs leading-relaxed text-muted-foreground">
          Local notes and the account connection are kept.
        </p>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
