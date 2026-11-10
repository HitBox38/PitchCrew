import { useState } from 'react';
import { Keyboard, MoreHorizontal, Save } from 'lucide-react';
import { Button } from '@pitchcrew/design-system/button';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from '@pitchcrew/design-system/dropdown-menu';
import { MarkdownShortcuts } from '@/components/MarkdownEditor/components/MarkdownShortcuts.tsx';
import { editorKeys, shortcutLabel } from '@/components/MarkdownEditor/shortcuts.ts';
import type { ProfileSectionProps } from '../types.ts';

/** Saving preferences for this device and the editor's shortcut list. */
export const ProfileStatusMenu = ({ controller: c, workspace: w }: ProfileSectionProps) => {
  const [help, setHelp] = useState(false);
  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={<Button variant="ghost" size="icon-sm" className="profile-status-more" />}
          aria-label="Editor options"
        >
          <MoreHorizontal size={16} aria-hidden="true" />
        </DropdownMenuTrigger>
        <DropdownMenuContent side="top" align="end" className="w-64">
          <DropdownMenuGroup>
            <DropdownMenuCheckboxItem
              checked={c.autosave}
              onCheckedChange={(checked) => c.setAutosave(checked)}
            >
              Save automatically
            </DropdownMenuCheckboxItem>
            <DropdownMenuItem
              disabled={!c.dirty || !!c.blocker || !!c.active?.conflict}
              onClick={() => void c.save()}
            >
              <Save size={15} aria-hidden="true" /> Save now
              <DropdownMenuShortcut className="md-key-hint">
                {shortcutLabel(editorKeys.save)}
              </DropdownMenuShortcut>
            </DropdownMenuItem>
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuGroup>
            <DropdownMenuCheckboxItem checked={w.showSyntax} onCheckedChange={w.setShowSyntax}>
              Show Markdown syntax
            </DropdownMenuCheckboxItem>
            <DropdownMenuItem className="md-key-hint" onClick={() => setHelp(true)}>
              <Keyboard size={15} aria-hidden="true" /> Keyboard shortcuts
            </DropdownMenuItem>
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
      <MarkdownShortcuts open={help} onOpenChange={setHelp} />
    </>
  );
};
