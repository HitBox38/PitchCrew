import { useEffect, useState } from 'react';
import { Search } from 'lucide-react';
import { Button } from '@pitchcrew/design-system/button';
import {
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
} from '@pitchcrew/design-system/command';
import { SettingCommands } from './SettingCommands.tsx';

export const SettingsSearch = () => {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const find = (event: KeyboardEvent) => {
      if (
        event.defaultPrevented ||
        event.isComposing ||
        event.key !== '/' ||
        event.ctrlKey ||
        event.metaKey ||
        event.altKey
      )
        return;
      const target = event.target;
      if (
        target instanceof Element &&
        target.closest(
          'input, textarea, select, [contenteditable="true"], [role="dialog"], [role="listbox"], [role="menu"]',
        )
      )
        return;
      if (document.querySelector('[role="dialog"][aria-modal="true"]')) return;
      event.preventDefault();
      setOpen(true);
    };
    window.addEventListener('keydown', find);
    return () => window.removeEventListener('keydown', find);
  }, []);
  return (
    <>
      <Button
        variant="ghost"
        className="settings-search-trigger"
        aria-label="Find a setting"
        aria-haspopup="dialog"
        title="Find a setting (/)"
        onClick={() => setOpen(true)}
      >
        <Search size={15} aria-hidden="true" />
        <span>Find a setting</span>
        <kbd aria-hidden="true" className="settings-search-key">
          /
        </kbd>
      </Button>
      <CommandDialog
        open={open}
        onOpenChange={setOpen}
        title="Find a setting"
        description="Search settings and jump to the matching control."
        showCloseButton={false}
        commandProps={{
          filter: (value, query, keywords) => {
            const words = [value, ...(keywords ?? [])].join(' ').toLowerCase();
            return query
              .toLowerCase()
              .trim()
              .split(/\s+/)
              .every((term) => words.includes(term))
              ? 1
              : 0;
          },
        }}
      >
        <CommandInput placeholder="Search settings, e.g. sounds…" />
        <CommandList>
          <CommandEmpty>No matching settings.</CommandEmpty>
          <SettingCommands
            always
            run={(action) => () => {
              setOpen(false);
              action();
            }}
          />
        </CommandList>
      </CommandDialog>
    </>
  );
};
