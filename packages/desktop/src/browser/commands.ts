import { shell } from 'electron';
import type { NativeBrowserCommand } from '../../../core/src/native-browser.ts';
import { isAllowedExternalUrl } from '../external-url.ts';
import type { NativeGroup } from './pages.ts';

export const runNativeBrowserCommand = (
  group: NativeGroup,
  command: NativeBrowserCommand,
  agent = false,
) =>
  group.mutate(async () => {
    if (agent ? group.manualUntil > Date.now() : group.manualUntil <= Date.now())
      throw new Error('Browser control changed.');
    const page = group.pages.get(group.active);
    const contents = page?.contents;
    switch (command.kind) {
      case 'select-tab':
        group.select(command.tabId);
        break;
      case 'close-tab':
        await group.close(command.tabId);
        if (!group.pages.size) await group.create();
        break;
      case 'new-tab':
        await group.create();
        break;
      case 'back':
        if (contents?.navigationHistory.canGoBack()) contents.navigationHistory.goBack();
        break;
      case 'forward':
        if (contents?.navigationHistory.canGoForward()) contents.navigationHistory.goForward();
        break;
      case 'reload':
        if (!(await group.recover(group.active))) contents?.reload();
        break;
      case 'hard-reload':
        if (!(await group.recover(group.active))) contents?.reloadIgnoringCache();
        break;
      case 'stop':
        contents?.stop();
        break;
      case 'zoom':
        contents?.setZoomFactor(command.factor);
        break;
      case 'clear-cache':
        await contents?.session.clearCache();
        break;
      case 'mute': {
        const target = command.tabId ? group.pages.get(command.tabId)?.contents : contents;
        if (!target) throw new Error('Browser tab is closed.');
        target.setAudioMuted(command.muted);
        break;
      }
      case 'devtools':
        contents?.openDevTools({ mode: 'detach', activate: true });
        break;
      case 'open-external': {
        const url = contents?.getURL();
        if (!url || !isAllowedExternalUrl(url))
          throw new Error('This page cannot open in your browser.');
        await shell.openExternal(new URL(url).href);
        break;
      }
      case 'appearance':
        if (page) {
          await page.send('Emulation.setEmulatedMedia', {
            features:
              command.colorScheme === 'system'
                ? []
                : [{ name: 'prefers-color-scheme', value: command.colorScheme }],
          });
          group.appearance.set(page.id, command.colorScheme);
        }
        break;
    }
    group.changed();
    return group.state();
  });
