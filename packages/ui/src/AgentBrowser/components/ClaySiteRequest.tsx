import { useState } from 'react';
import { ChevronDown, Globe } from 'lucide-react';
import { Button } from '@pitchcrew/design-system/button';
import { Popover, PopoverContent, PopoverTrigger } from '@pitchcrew/design-system/popover';

/**
 * Task site grants without growing the fixed approval tray. A recessed Site access
 * chip on the target line says a grant is available and opens both existing grants with what each
 * allows. (A separate chip on the title line wrapped into an extra row at mid widths.)
 */
export const ClaySiteRequest = ({
  origin,
  browseDisabled,
  prepareDisabled,
  grant,
}: {
  origin: string;
  browseDisabled: boolean;
  prepareDisabled: boolean;
  grant: (exploration: boolean) => void;
}) => {
  const [open, setOpen] = useState(false);
  const host = origin.replace(/^https?:\/\//, '');
  const choose = (exploration: boolean) => {
    setOpen(false);
    grant(exploration);
  };
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button
            size="xs"
            variant="ghost"
            className="clay-site-trigger"
            aria-label={`Site access: a grant is available for ${host}`}
            title={`You can let this task skip asking on ${host}.`}
          />
        }
      >
        <Globe size={12} aria-hidden="true" />
        Site access
        <ChevronDown size={12} aria-hidden="true" />
      </PopoverTrigger>
      <PopoverContent className="clay-site-popover w-80 space-y-3 p-3 text-sm">
        <p className="font-semibold">
          Skip asking on <strong>{host}</strong> for this task?
        </p>
        <div className="space-y-1">
          <Button
            size="sm"
            variant="outline"
            aria-label="Allow browsing for this task"
            disabled={browseDisabled}
            onClick={() => choose(true)}
          >
            Allow browsing
          </Button>
          <p className="text-muted-foreground">
            Navigation, scrolling and hover on this site. Clicks, form changes, files and submission
            still ask.
          </p>
        </div>
        <div className="space-y-1">
          <Button
            size="sm"
            aria-label="Allow preparation for this task"
            disabled={prepareDisabled}
            onClick={() => choose(false)}
          >
            Allow preparation
          </Button>
          <p className="text-muted-foreground">
            Form answers and approved packet files. Buttons and submission still ask.
          </p>
        </div>
      </PopoverContent>
    </Popover>
  );
};
