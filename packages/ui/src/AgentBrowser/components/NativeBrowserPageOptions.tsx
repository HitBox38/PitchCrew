import { Button } from '@pitchcrew/design-system/button';
import { useId } from 'react';
import { Code2, Volume2, VolumeX } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@pitchcrew/design-system/select';
import type { NativeBrowserModel } from '../hooks/useNativeBrowser.ts';

const appearances = [
  { value: 'system', label: 'System' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
] as const;

export const NativeBrowserPageOptions = ({
  model,
  manual,
}: {
  model: NativeBrowserModel;
  manual: boolean;
}) => {
  const tab = model.state?.tabs.find((item) => item.id === model.state?.activeTab);
  const appearanceId = useId();
  return (
    <>
      <fieldset className="browser-menu-group" aria-label="Page options">
        <Button
          className="browser-menu-row"
          size="sm"
          variant="ghost"
          disabled={!manual}
          onClick={() => void model.command({ kind: 'mute', muted: !tab?.muted })}
        >
          {tab?.muted ? <Volume2 size={14} /> : <VolumeX size={14} />}
          {tab?.muted ? 'Unmute page' : 'Mute page'}
        </Button>
        <Button
          className="browser-menu-row"
          size="sm"
          variant="ghost"
          disabled={!manual}
          onClick={() => void model.command({ kind: 'devtools' })}
        >
          <Code2 size={14} />
          Open developer tools
        </Button>
      </fieldset>
      <div className="browser-menu-group browser-menu-field">
        <label htmlFor={appearanceId}>Website appearance</label>
        <Select
          items={appearances}
          value={tab?.colorScheme ?? 'system'}
          disabled={!manual}
          onValueChange={(value) => {
            if (value) void model.command({ kind: 'appearance', colorScheme: value });
          }}
        >
          <SelectTrigger id={appearanceId} aria-label="Website appearance">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {appearances.map((item) => (
              <SelectItem key={item.value} value={item.value}>
                {item.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </>
  );
};
