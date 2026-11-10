import { useRef } from 'react';
import { Check, ChevronDown, Heading1, Heading2, Heading3, Pilcrow } from 'lucide-react';
import { Button } from '@pitchcrew/design-system/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from '@pitchcrew/design-system/dropdown-menu';
import { editorKeys, shortcutLabel } from '../shortcuts.ts';
import type { MarkdownFormat } from '../types.ts';

const levels = [
  ['paragraph', 'Text', Pilcrow],
  ['h1', 'Heading 1', Heading1],
  ['h2', 'Heading 2', Heading2],
  ['h3', 'Heading 3', Heading3],
] as const;

/** Turns the current lines into text or a heading level. */
export const HeadingMenu = ({
  disabled,
  format,
  active = [],
}: {
  disabled?: boolean;
  format: (kind: MarkdownFormat) => void;
  active?: readonly MarkdownFormat[];
}) => {
  const current = levels.find(([kind]) => active.includes(kind)) ?? levels[0];
  // A chosen style focuses the text; Escape returns focus to the trigger as usual.
  const chosen = useRef(false);
  return (
    <DropdownMenu
      onOpenChange={(open) => {
        if (open) chosen.current = false;
      }}
    >
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            size="sm"
            className="md-tool md-heading-tool"
            disabled={disabled}
            onMouseDown={(event) => event.preventDefault()}
          />
        }
        aria-label={`Text style: ${current[1]}`}
      >
        <span className="md-heading-label">
          {current[0] === 'paragraph' ? '¶' : current[0].toUpperCase()}
        </span>
        <ChevronDown size={12} aria-hidden="true" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-52" finalFocus={() => !chosen.current}>
        <DropdownMenuGroup>
          {levels.map(([kind, label, Icon]) => (
            <DropdownMenuItem
              key={kind}
              onClick={() => {
                chosen.current = true;
                format(kind);
              }}
            >
              <span className="md-menu-check" aria-hidden="true">
                {kind === current[0] ? <Check size={14} /> : null}
              </span>
              <Icon size={15} aria-hidden="true" /> {label}
              {kind === current[0] ? <span className="sr-only">(current)</span> : null}
              <DropdownMenuShortcut>{shortcutLabel(editorKeys[kind])}</DropdownMenuShortcut>
            </DropdownMenuItem>
          ))}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
