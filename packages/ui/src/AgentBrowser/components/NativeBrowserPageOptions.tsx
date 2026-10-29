import { Button } from '@/components/ui/button/components/Button.tsx';
import { useId } from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select/index.tsx';
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
    <div className="mt-3 grid gap-2">
      <label className="grid gap-1 text-xs" htmlFor={appearanceId}>
        Website appearance
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
      </label>
      <Button
        size="sm"
        variant="outline"
        disabled={!manual}
        onClick={() => void model.command({ kind: 'mute', muted: !tab?.muted })}
      >
        {tab?.muted ? 'Unmute page' : 'Mute page'}
      </Button>
      <Button
        size="sm"
        variant="outline"
        disabled={!manual || !/^https?:\/\//i.test(tab?.url ?? '')}
        onClick={() => void model.command({ kind: 'open-external' })}
      >
        Open in system browser
      </Button>
      <Button
        size="sm"
        variant="outline"
        disabled={!manual}
        onClick={() => void model.command({ kind: 'devtools' })}
      >
        Open developer tools
      </Button>
    </div>
  );
};
