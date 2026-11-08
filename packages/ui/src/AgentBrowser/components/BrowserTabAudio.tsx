import { Volume2, VolumeX } from 'lucide-react';
import { Button } from '@pitchcrew/design-system/button';
import type { NativeBrowserState } from '../../../../core/src/native-browser.ts';
import type { NativeBrowserModel } from '../hooks/useNativeBrowser.ts';

/** A tab's mute toggle, shown while it plays sound or stays muted. */
export const BrowserTabAudio = ({
  model,
  tab,
  label,
  manual,
}: {
  model: NativeBrowserModel;
  tab: NativeBrowserState['tabs'][number];
  label: string;
  manual: boolean;
}) =>
  tab.audible || tab.muted ? (
    <Button
      size="icon-sm"
      variant="ghost"
      className="browser-tab-audio"
      aria-label={`${tab.muted ? 'Unmute' : 'Mute'} ${label}`}
      disabled={!manual}
      onClick={() => void model.command({ kind: 'mute', muted: !tab.muted, tabId: tab.id })}
    >
      {tab.muted ? <VolumeX size={12} /> : <Volume2 size={12} />}
    </Button>
  ) : null;
