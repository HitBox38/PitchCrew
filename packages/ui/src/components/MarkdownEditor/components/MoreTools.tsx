import { MoreHorizontal } from 'lucide-react';
import { Button } from '@pitchcrew/design-system/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from '@pitchcrew/design-system/dropdown-menu';
import { blockTools, extraTools, inlineTools } from '../toolbar.ts';
import { editorKeys, shortcutLabel } from '../shortcuts.ts';
import type { MarkdownFormat } from '../types.ts';

const extras = [...inlineTools, ...blockTools].filter(([kind]) => extraTools.has(kind));

/** On a narrow sheet the less used tools fold in here instead of running off the edge. */
export const MoreTools = ({
  disabled,
  format,
}: {
  disabled?: boolean;
  format: (kind: MarkdownFormat) => void;
}) => (
  <DropdownMenu>
    <DropdownMenuTrigger
      render={
        <Button
          variant="ghost"
          size="icon-sm"
          className="md-tool md-more-tool"
          disabled={disabled}
          onMouseDown={(event) => event.preventDefault()}
        />
      }
      aria-label="More formatting"
    >
      <MoreHorizontal size={16} aria-hidden="true" />
    </DropdownMenuTrigger>
    <DropdownMenuContent align="start" className="w-56" finalFocus={false}>
      <DropdownMenuGroup>
        {extras.map(([kind, label, Icon]) => (
          <DropdownMenuItem key={kind} onClick={() => format(kind)}>
            <Icon size={15} aria-hidden="true" /> {label}
            {kind in editorKeys ? (
              <DropdownMenuShortcut className="md-key-hint">
                {shortcutLabel(editorKeys[kind as keyof typeof editorKeys])}
              </DropdownMenuShortcut>
            ) : null}
          </DropdownMenuItem>
        ))}
      </DropdownMenuGroup>
    </DropdownMenuContent>
  </DropdownMenu>
);
