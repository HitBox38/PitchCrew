import { Columns2, Eye, PencilLine } from 'lucide-react';
import { Tabs, TabsIndicator, TabsList, TabsTrigger } from '@pitchcrew/design-system/tabs';
import type { MarkdownMode } from '../types.ts';

const modes = [
  { value: 'write', label: 'Write', icon: PencilLine },
  { value: 'split', label: 'Split', icon: Columns2 },
  { value: 'preview', label: 'Preview', icon: Eye },
] as const;

/** Write | Split | Preview; Split is offered only where the sheet has room for two columns. */
export const MarkdownModeSwitch = ({
  label,
  value,
  onChange,
  split = true,
  className = '',
}: {
  label: string;
  value: MarkdownMode;
  onChange: (mode: MarkdownMode) => void;
  split?: boolean;
  className?: string;
}) => (
  <Tabs
    value={value}
    onValueChange={(mode) => {
      if (mode === 'write' || mode === 'split' || mode === 'preview') onChange(mode);
    }}
    className="contents"
  >
    <TabsList aria-label={label} className={`ui-segment md-mode-switch ${className}`}>
      {modes
        .filter((mode) => split || mode.value !== 'split')
        .map(({ value: mode, label: name, icon: Icon }) => (
          <TabsTrigger key={mode} value={mode} aria-label={name} title={name}>
            <Icon size={14} aria-hidden="true" />
            <span className="md-mode-label">{name}</span>
          </TabsTrigger>
        ))}
      <TabsIndicator />
    </TabsList>
  </Tabs>
);
