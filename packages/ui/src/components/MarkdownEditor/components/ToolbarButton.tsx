import type { ComponentProps, ReactNode } from 'react';
import { Button } from '@pitchcrew/design-system/button';
import { Kbd } from '@pitchcrew/design-system/kbd';
import { Tooltip, TooltipContent, TooltipTrigger } from '@pitchcrew/design-system/tooltip';
import { shortcutLabel, shortcutAria } from '../shortcuts.ts';

/** An icon button whose tooltip names the action and its shortcut. */
export const ToolbarButton = ({
  label,
  keys,
  pressed,
  children,
  ...props
}: ComponentProps<typeof Button> & {
  label: string;
  keys?: readonly string[];
  pressed?: boolean;
  children: ReactNode;
}) => (
  <Tooltip>
    <TooltipTrigger
      render={
        <Button
          variant="ghost"
          size="icon-sm"
          className="md-tool"
          aria-label={label}
          aria-pressed={pressed}
          aria-keyshortcuts={keys ? shortcutAria(keys) : undefined}
          // Keep the editor's selection: toolbar clicks must not take focus from the text.
          onMouseDown={(event) => event.preventDefault()}
          {...props}
        />
      }
    >
      {children}
    </TooltipTrigger>
    <TooltipContent className="md-tool-tip" side="bottom">
      {label}
      {keys ? <Kbd>{shortcutLabel(keys)}</Kbd> : null}
    </TooltipContent>
  </Tooltip>
);
