import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { CommandItem, CommandShortcut } from '@pitchcrew/design-system/command';

/** One 40px result: icon or mark, the name, one line of muted context and an optional key. */
export const PaletteItem = ({
  value,
  keywords,
  icon: Icon,
  mark,
  label,
  context,
  shortcut,
  onSelect,
}: {
  value: string;
  keywords?: string[];
  icon?: LucideIcon;
  mark?: ReactNode;
  label: ReactNode;
  context?: ReactNode;
  shortcut?: string;
  onSelect: () => void;
}) => (
  <CommandItem value={value} keywords={keywords} onSelect={onSelect}>
    {mark ?? (Icon ? <Icon aria-hidden="true" /> : null)}
    <span className="command-label">{label}</span>
    {context ? <span className="command-context">{context}</span> : null}
    {shortcut ? <CommandShortcut>{shortcut}</CommandShortcut> : null}
  </CommandItem>
);
