import { CircleHelp } from 'lucide-react';
import { Button } from '@/components/ui/button/components/Button.tsx';
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
  PopoverTitle,
} from '@/components/ui/popover/index.tsx';
export const BrowserModeHelp = ({ name }: { name: string }) => {
  return (
    <Popover>
      <PopoverTrigger
        render={
          <Button
            size="icon-sm"
            variant="ghost"
            aria-label={`${name} browser permission details`}
          />
        }
      >
        <CircleHelp size={15} />
      </PopoverTrigger>
      <PopoverContent className="w-80 max-w-[calc(100vw-24px)] p-3 font-sans text-sm leading-5">
        <PopoverTitle className="m-0 font-sans text-sm leading-5 font-semibold">
          {name}’s next turn in this conversation
        </PopoverTitle>
        <p className="mt-2">
          <strong>Supervised:</strong> every browser action asks for your approval.
        </p>
        <p className="mt-2">
          <strong>Autonomous preparation:</strong> allow a site for the task, then the agent can
          browse agreed sites, scroll and hover, or separately prepare supported forms. Other
          actions, including submission, still ask.
        </p>
        <p className="mt-2 text-muted-foreground">
          Changes apply to future turns. The browser panel shows the active task’s permissions.
          Scheduled routines stay supervised.
        </p>
      </PopoverContent>
    </Popover>
  );
};
