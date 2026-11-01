import { useCommandState } from 'cmdk';
import { useNavigate } from '@tanstack/react-router';
import { CommandGroup } from '@/components/ui/command/components/CommandGroup.tsx';
import { settingsSections } from '@/SettingsPage/constants.ts';
import { settingEntries } from '@/SettingsPage/search.ts';
import type { SettingsCommandsProps } from '../types.ts';
import { preferenceCommands } from '../preference-commands.ts';
import { PaletteItem } from './PaletteItem.tsx';

/**
 * Settings: appearance, sidebar, runtime, data and update commands, then, once two letters are
 * typed, every setting by name, opening its exact section.
 */
export const SettingsCommands = (props: SettingsCommandsProps) => {
  const query = useCommandState((state) => state.search);
  const navigate = useNavigate();
  const commands = preferenceCommands(props);
  return (
    <CommandGroup heading="Settings">
      {commands.map(({ action, ...item }) => (
        <PaletteItem key={item.value} {...item} onSelect={props.run(action)} />
      ))}
      {query.trim().length < 2
        ? null
        : settingEntries.map((entry) => {
            const section = settingsSections.find((item) => item.id === entry.section)!;
            return (
              <PaletteItem
                key={entry.target}
                value={`Settings ${entry.label}`}
                keywords={entry.keywords}
                icon={section.icon}
                label={entry.label}
                context={section.label}
                onSelect={props.run(() => {
                  void navigate({
                    to: '/settings',
                    search: { section: entry.section },
                    hash: entry.target,
                  });
                })}
              />
            );
          })}
    </CommandGroup>
  );
};
