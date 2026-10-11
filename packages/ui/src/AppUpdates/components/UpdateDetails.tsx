import { Button } from '@/components/ui/button/components/Button.tsx';
import {
  PopoverContent,
  PopoverDescription,
  PopoverTitle,
} from '@/components/ui/popover/index.tsx';
import { ReleaseLink } from './ReleaseLink.tsx';

export function UpdateDetails({
  url,
  dismiss,
  finalFocus,
}: {
  url: string;
  dismiss: () => void;
  finalFocus: () => HTMLElement | boolean | null;
}) {
  return (
    <PopoverContent
      className="flex w-80 max-w-[calc(100vw-2rem)] flex-col gap-3 p-4"
      finalFocus={finalFocus}
    >
      <PopoverTitle className="font-semibold">Pitchcrew update available</PopoverTitle>
      <PopoverDescription className="text-sm text-muted-foreground">
        A newer Pitchcrew build is available. View the release to download it and install when
        you’re ready.
      </PopoverDescription>
      <ReleaseLink url={url} />
      <Button variant="ghost" aria-label="Dismiss update notice" onClick={dismiss}>
        Dismiss for this session
      </Button>
    </PopoverContent>
  );
}
