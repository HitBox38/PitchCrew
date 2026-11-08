import { Search } from 'lucide-react';
import { Button } from '@pitchcrew/design-system/button';
import { Popover, PopoverContent, PopoverTrigger } from '@pitchcrew/design-system/popover';
import type { NativeBrowserModel } from '../hooks/useNativeBrowser.ts';
import { browserShortcut } from '../helpers.ts';
import { NativeBrowserFind } from './NativeBrowserFind.tsx';

/**
 * Find opens as a pill under its button, over the page's top-right corner. A popover renders
 * above the native page; content in the panel itself would sit beneath it.
 */
export const NativeBrowserFindPopover = ({
  model,
  manual,
}: {
  model: NativeBrowserModel;
  manual: boolean;
}) => {
  const id = model.identity!.id;
  return (
    <Popover open={model.findOpen} onOpenChange={model.setFindOpen} modal={false}>
      <PopoverTrigger
        render={
          <Button
            size="icon-sm"
            variant="ghost"
            aria-label="Find on page"
            title={
              manual
                ? `Find on page (${browserShortcut('f')})`
                : 'Searching moves the page, so it waits until you have control'
            }
            disabled={!manual}
          />
        }
      >
        <Search size={15} />
      </PopoverTrigger>
      <PopoverContent
        align="end"
        sideOffset={8}
        finalFocus={false}
        className="browser-find-popover p-1"
      >
        <NativeBrowserFind key={id} id={id} close={() => model.setFindOpen(false)} />
      </PopoverContent>
    </Popover>
  );
};
