import { Button } from '@pitchcrew/design-system/button';
import { Code2, Volume2, VolumeX } from 'lucide-react';
import type { NativeBrowserModel } from '../hooks/useNativeBrowser.ts';

const appearances = [
  { value: 'system', label: 'System' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
] as const;

/** Per-page options as menu rows, and the website's appearance as a three-way segment. */
export const NativeBrowserPageOptions = ({
  model,
  manual,
}: {
  model: NativeBrowserModel;
  manual: boolean;
}) => {
  const tab = model.state?.tabs.find((item) => item.id === model.state?.activeTab);
  const current = tab?.colorScheme ?? 'system';
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
      <fieldset className="browser-menu-zoom" aria-label="Website appearance">
        <span className="browser-menu-zoom-label">Appearance</span>
        <div className="browser-menu-segment">
          {appearances.map((item) => (
            <Button
              key={item.value}
              size="sm"
              variant="ghost"
              aria-pressed={current === item.value}
              disabled={!manual}
              onClick={() => void model.command({ kind: 'appearance', colorScheme: item.value })}
            >
              {item.label}
            </Button>
          ))}
        </div>
      </fieldset>
    </>
  );
};
