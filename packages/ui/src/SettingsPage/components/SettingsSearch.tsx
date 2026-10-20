import { useState } from 'react';
import { Search } from 'lucide-react';
import { Button } from '@/components/ui/button/components/Button.tsx';
import { CommandDialog } from '@/components/ui/command/components/CommandDialog.tsx';
import { CommandInput } from '@/components/ui/command/components/CommandInput.tsx';
import { CommandList } from '@/components/ui/command/components/CommandList.tsx';
import { CommandEmpty } from '@/components/ui/command/components/CommandEmpty.tsx';
import { SettingCommands } from './SettingCommands.tsx';
export const SettingsSearch = () => {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button
        variant="outline"
        size="sm"
        className="settings-search-trigger"
        aria-label="Find a setting"
        onClick={() => setOpen(true)}
      >
        <Search size={15} aria-hidden="true" />
        <span className="max-mobile:sr-only">Find a setting…</span>
      </Button>
      <CommandDialog
        open={open}
        onOpenChange={setOpen}
        title="Find a setting"
        description="Search settings and jump to the matching control."
        showCloseButton={false}
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
