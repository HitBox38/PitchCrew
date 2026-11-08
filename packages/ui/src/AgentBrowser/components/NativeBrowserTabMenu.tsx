import type { ReactElement } from 'react';
import { ArrowRightToLine, Copy, Volume2, VolumeX, X, XSquare } from 'lucide-react';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuGroup,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from '@pitchcrew/design-system/context-menu';
import type { NativeBrowserState } from '../../../../core/src/native-browser.ts';
import { copyText } from '@/lib/clipboard.ts';
import type { NativeBrowserModel } from '../hooks/useNativeBrowser.ts';

type NativeBrowserTab = NativeBrowserState['tabs'][number];

/** A tab's right-click menu: close it, the others or those to its right, mute, copy address. */
export const NativeBrowserTabMenu = ({
  model,
  tab,
  manual,
  children,
}: {
  model: NativeBrowserModel;
  tab: NativeBrowserTab;
  manual: boolean;
  children: ReactElement;
}) => {
  const tabs = model.state?.tabs ?? [];
  const index = tabs.findIndex((item) => item.id === tab.id);
  const close = async (ids: string[]) => {
    // One at a time: each close settles its native capture before the next selection.
    for (const id of ids) await model.command({ kind: 'close-tab', tabId: id });
  };
  const others = tabs.filter((item) => item.id !== tab.id).map((item) => item.id);
  const right = tabs.slice(index + 1).map((item) => item.id);
  const web = /^https?:\/\//i.test(tab.url);
  return (
    <ContextMenu>
      <ContextMenuTrigger render={children} />
      <ContextMenuContent className="min-w-52" aria-label="Tab actions">
        <ContextMenuGroup>
          <ContextMenuItem disabled={!manual} onClick={() => void close([tab.id])}>
            <X />
            Close tab
          </ContextMenuItem>
          <ContextMenuItem disabled={!manual || !others.length} onClick={() => void close(others)}>
            <XSquare />
            Close other tabs
          </ContextMenuItem>
          <ContextMenuItem disabled={!manual || !right.length} onClick={() => void close(right)}>
            <ArrowRightToLine />
            Close tabs to the right
          </ContextMenuItem>
        </ContextMenuGroup>
        <ContextMenuSeparator />
        <ContextMenuGroup>
          <ContextMenuItem
            disabled={!manual}
            onClick={() => void model.command({ kind: 'mute', muted: !tab.muted, tabId: tab.id })}
          >
            {tab.muted ? <Volume2 /> : <VolumeX />}
            {tab.muted ? 'Unmute tab' : 'Mute tab'}
          </ContextMenuItem>
          <ContextMenuItem disabled={!web} onClick={() => copyText(tab.url, 'Address copied')}>
            <Copy />
            Copy page address
          </ContextMenuItem>
        </ContextMenuGroup>
      </ContextMenuContent>
    </ContextMenu>
  );
};
