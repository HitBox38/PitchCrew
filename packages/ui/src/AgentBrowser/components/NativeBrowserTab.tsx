import { X } from 'lucide-react';
import { useSortable } from '@dnd-kit/react/sortable';
import { Button } from '@pitchcrew/design-system/button';
import { useAppReducedMotion } from '@/AppMotion/hooks/useAppReducedMotion.ts';
import type { NativeBrowserState } from '../../../../core/src/native-browser.ts';
import type { NativeBrowserModel } from '../hooks/useNativeBrowser.ts';
import { browserTabLabel } from '../helpers.ts';
import { BrowserTabIcon } from './BrowserTabIcon.tsx';
import { NativeBrowserTabMenu } from './NativeBrowserTabMenu.tsx';
import { BrowserTabAudio } from './BrowserTabAudio.tsx';

/** One tab: select, drag or Control+Shift+Page Up/Down to move, mute and close. */
export const NativeBrowserTab = ({
  model,
  tab,
  index,
  count,
  manual,
  move,
}: {
  model: NativeBrowserModel;
  tab: NativeBrowserState['tabs'][number];
  index: number;
  count: number;
  manual: boolean;
  move: (index: number) => void;
}) => {
  const reduced = useAppReducedMotion();
  const label = browserTabLabel(tab);
  const active = tab.id === model.state?.activeTab;
  const { ref, isDragging } = useSortable({
    id: tab.id,
    index,
    group: 'browser-tabs',
    type: 'browser-tab',
    disabled: !manual || count < 2,
    data: { label, count },
    transition: { duration: reduced ? 0 : 160 },
  });
  const close = () => void model.command({ kind: 'close-tab', tabId: tab.id });
  return (
    <NativeBrowserTabMenu model={model} tab={tab} index={index} manual={manual} move={move}>
      <div
        ref={ref}
        className="browser-tab"
        data-active={active}
        data-dragging={isDragging || undefined}
        data-failed={tab.error ? '' : undefined}
        // Middle-click closes a tab, as in other browsers.
        onAuxClick={(event) => {
          if (event.button === 1 && manual) close();
        }}
      >
        <Button
          size="sm"
          variant={active ? 'secondary' : 'ghost'}
          className="browser-tab-select"
          // Full-contrast labels while an agent works: the tab is unavailable, not dimmed away.
          aria-disabled={!manual || undefined}
          title={tab.url && tab.url !== 'about:blank' ? `${label}\n${tab.url}` : label}
          role="tab"
          aria-selected={active}
          aria-keyshortcuts="Control+Shift+PageUp Control+Shift+PageDown"
          tabIndex={active ? 0 : -1}
          onClick={() => {
            if (manual) void model.command({ kind: 'select-tab', tabId: tab.id });
          }}
          onKeyDown={(event) => {
            if (!event.ctrlKey || !event.shiftKey || !/^Page(Up|Down)$/.test(event.key)) return;
            event.preventDefault();
            event.stopPropagation();
            move(index + (event.key === 'PageUp' ? -1 : 1));
          }}
        >
          <BrowserTabIcon loading={tab.loading} favicon={tab.favicon} failed={!!tab.error} />
          <span className="truncate">{label}</span>
        </Button>
        <BrowserTabAudio model={model} tab={tab} label={label} manual={manual} />
        <Button
          size="icon-sm"
          variant="ghost"
          className="browser-tab-close"
          // Out of the Tab order: Control+W, middle-click and the tab menu close tabs too.
          tabIndex={-1}
          aria-label={`Close ${label}`}
          disabled={!manual || isDragging}
          onClick={close}
        >
          <X size={12} />
        </Button>
      </div>
    </NativeBrowserTabMenu>
  );
};
