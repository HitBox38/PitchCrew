import { Volume2, VolumeX, X } from 'lucide-react';
import { Button } from '@pitchcrew/design-system/button';
import type { NativeBrowserModel } from '../hooks/useNativeBrowser.ts';
import { browserTabLabel, moveTabFocus } from '../helpers.ts';
import { BrowserTabIcon } from './BrowserTabIcon.tsx';
import { NativeBrowserTabMenu } from './NativeBrowserTabMenu.tsx';
import { NativeBrowserNewTab } from './NativeBrowserNewTab.tsx';
export const NativeBrowserTabs = ({
  model,
  manual,
}: {
  model: NativeBrowserModel;
  manual: boolean;
}) => (
  <div className="browser-tab-strip">
    <div
      className="browser-tabs"
      role="tablist"
      aria-label="Browser tabs"
      tabIndex={-1}
      onKeyDown={moveTabFocus}
    >
      {model.state?.tabs.map((item) => {
        const label = browserTabLabel(item);
        const close = () => void model.command({ kind: 'close-tab', tabId: item.id });
        return (
          <NativeBrowserTabMenu key={item.id} model={model} tab={item} manual={manual}>
            <div
              className="browser-tab"
              data-active={item.id === model.state?.activeTab}
              data-failed={item.error ? '' : undefined}
              // Middle-click closes a tab, as in other browsers.
              onAuxClick={(event) => {
                if (event.button === 1 && manual) close();
              }}
            >
              <Button
                size="sm"
                variant={item.id === model.state?.activeTab ? 'secondary' : 'ghost'}
                className="browser-tab-select"
                disabled={!manual}
                title={item.url && item.url !== 'about:blank' ? `${label}\n${item.url}` : label}
                role="tab"
                aria-selected={item.id === model.state?.activeTab}
                tabIndex={item.id === model.state?.activeTab ? 0 : -1}
                onClick={() => void model.command({ kind: 'select-tab', tabId: item.id })}
              >
                <BrowserTabIcon
                  loading={item.loading}
                  favicon={item.favicon}
                  failed={!!item.error}
                />
                <span className="truncate">{label}</span>
              </Button>
              {item.audible || item.muted ? (
                <Button
                  size="icon-sm"
                  variant="ghost"
                  className="browser-tab-audio"
                  aria-label={`${item.muted ? 'Unmute' : 'Mute'} ${label}`}
                  disabled={!manual}
                  onClick={() =>
                    void model.command({ kind: 'mute', muted: !item.muted, tabId: item.id })
                  }
                >
                  {item.muted ? <VolumeX size={12} /> : <Volume2 size={12} />}
                </Button>
              ) : null}
              <Button
                size="icon-sm"
                variant="ghost"
                className="browser-tab-close"
                aria-label={`Close ${label}`}
                disabled={!manual}
                onClick={close}
              >
                <X size={12} />
              </Button>
            </div>
          </NativeBrowserTabMenu>
        );
      })}
    </div>
    <NativeBrowserNewTab model={model} manual={manual} />
  </div>
);
