import { Plus, Volume2, VolumeX, X } from 'lucide-react';
import { Button } from '@/components/ui/button/components/Button.tsx';
import type { NativeBrowserModel } from '../hooks/useNativeBrowser.ts';
import { BrowserTabIcon } from './BrowserTabIcon.tsx';
export const NativeBrowserTabs = ({
  model,
  manual,
}: {
  model: NativeBrowserModel;
  manual: boolean;
}) => (
  <div className="browser-tabs" aria-label="Browser tabs">
    {model.state?.tabs.map((item) => (
      <div key={item.id} className="browser-tab" data-active={item.id === model.state?.activeTab}>
        <Button
          size="sm"
          variant={item.id === model.state?.activeTab ? 'secondary' : 'ghost'}
          className="browser-tab-select"
          disabled={!manual}
          title={item.title || 'New tab'}
          aria-current={item.id === model.state?.activeTab ? 'page' : undefined}
          onClick={() => void model.command({ kind: 'select-tab', tabId: item.id })}
        >
          <BrowserTabIcon loading={item.loading} favicon={item.favicon} />
          <span className="truncate">{item.title || 'New tab'}</span>
        </Button>
        {item.audible || item.muted ? (
          <Button
            size="icon-sm"
            variant="ghost"
            className="browser-tab-audio"
            aria-label={`${item.muted ? 'Unmute' : 'Mute'} ${item.title || 'tab'}`}
            disabled={!manual}
            onClick={() => void model.command({ kind: 'mute', muted: !item.muted, tabId: item.id })}
          >
            {item.muted ? <VolumeX size={12} /> : <Volume2 size={12} />}
          </Button>
        ) : null}
        <Button
          size="icon-sm"
          variant="ghost"
          className="browser-tab-close"
          aria-label={`Close ${item.title || 'tab'}`}
          disabled={!manual}
          onClick={() => void model.command({ kind: 'close-tab', tabId: item.id })}
        >
          <X size={12} />
        </Button>
      </div>
    ))}
    <Button
      size="icon-sm"
      variant="ghost"
      className="browser-tab-new"
      aria-label="New browser tab"
      disabled={!manual}
      onClick={() =>
        void model.command({ kind: 'new-tab' }).then(() => {
          const address = document.querySelector<HTMLInputElement>(
            '[aria-label="Browser address"]',
          );
          address?.focus();
          address?.select();
        })
      }
    >
      <Plus size={14} />
    </Button>
  </div>
);
