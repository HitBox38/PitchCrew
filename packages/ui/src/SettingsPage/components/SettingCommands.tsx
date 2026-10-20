import { useCommandState } from 'cmdk';
import { useNavigate } from '@tanstack/react-router';
import { CommandGroup } from '@/components/ui/command/components/CommandGroup.tsx';
import { CommandItem } from '@/components/ui/command/components/CommandItem.tsx';
import { settingEntries } from '../search.ts';
import { settingsSections } from '../constants.ts';
export const SettingCommands = ({
  run,
  always = false,
}: {
  run: (action: () => void) => () => void;
  always?: boolean;
}) => {
  const query = useCommandState((state) => state.search);
  const navigate = useNavigate();
  if (!always && query.trim().length < 2) return null;
  return (
    <CommandGroup heading="Settings">
      {settingEntries.map((entry) => {
        const section = settingsSections.find((item) => item.id === entry.section)!;
        const Icon = section.icon;
        return (
          <CommandItem
            key={entry.target}
            value={`Settings ${entry.label}`}
            keywords={entry.keywords}
            onSelect={run(() => {
              void navigate({
                to: '/settings',
                search: { section: entry.section },
                hash: entry.target,
              });
            })}
          >
            <Icon aria-hidden="true" />
            <span className="min-w-0 flex-1">{entry.label}</span>
            <span className="text-xs text-muted-foreground">{section.label}</span>
          </CommandItem>
        );
      })}
    </CommandGroup>
  );
};
