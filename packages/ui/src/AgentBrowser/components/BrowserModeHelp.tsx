import { CircleHelp } from 'lucide-react';
import { Button } from '@pitchcrew/design-system/button';
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
  PopoverTitle,
} from '@pitchcrew/design-system/popover';
import {
  browserModeLabels,
  browserModeLimits,
  browserModeOrder,
  browserModeSummaries,
} from '@pitchcrew/core/browser-modes';

/** Every browser mode in the shared words, most supervised first, then what holds in all of them. */
export const BrowserModeHelp = ({ name }: { name: string }) => {
  return (
    <Popover>
      <PopoverTrigger
        render={
          <Button
            size="icon-sm"
            variant="ghost"
            aria-label={`${name} browser permission details`}
            title="Browser permission details"
          />
        }
      >
        <CircleHelp size={15} />
      </PopoverTrigger>
      <PopoverContent className="w-80 max-w-[calc(100vw-24px)] p-3 font-sans text-sm leading-5">
        <PopoverTitle className="m-0 font-sans text-sm leading-5 font-semibold">
          {name}’s next turn in this conversation
        </PopoverTitle>
        {browserModeOrder.map((mode) => (
          <p key={mode} className="mt-2">
            <strong>{browserModeLabels[mode]}:</strong> {browserModeSummaries[mode]}
          </p>
        ))}
        <p className="mt-2 text-muted-foreground">{browserModeLimits}</p>
        <p className="mt-2 text-muted-foreground">
          Changes apply to future turns. The browser panel shows the active task’s permissions.
        </p>
      </PopoverContent>
    </Popover>
  );
};
