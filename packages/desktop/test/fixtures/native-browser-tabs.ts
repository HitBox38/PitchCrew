import type { BrowserDriver } from '../../../mcp/src/computer/types.ts';

export const checkNativeBrowserTabs = async (driver: BrowserDriver) => {
  // Exercise the same tab commands as the chat browser, then the agent tab tools.
  for (const manual of [true, false]) {
    await driver.setManual!(manual);
    const changeTab = async (kind: 'open' | 'close', tabId?: string) => {
      if (manual)
        await driver.nativeCommand!(
          kind === 'open' ? { kind: 'new-tab' } : { kind: 'close-tab', tabId: tabId! },
        );
      else
        await driver.tabs!(kind === 'open' ? { kind: 'open' } : { kind: 'close', tabId: tabId! });
      return driver.nativeState!();
    };
    const first = (await driver.nativeState!()).activeTab;
    const second = (await changeTab('open')).activeTab;
    const third = (await changeTab('open')).activeTab;
    const backgroundClosed = await changeTab('close', first);
    if (backgroundClosed.tabs.length !== 2 || backgroundClosed.activeTab !== third)
      throw new Error('Closing a background tab changed the selected native page.');
    const activeClosed = await changeTab('close', third);
    if (activeClosed.tabs.length !== 1 || activeClosed.activeTab !== second)
      throw new Error('Closing the active tab did not select the remaining native page.');
    let last = second;
    for (let cycle = 0; cycle < 3; cycle++) {
      const replacement = await changeTab('close', last);
      if (
        replacement.tabs.length !== 1 ||
        replacement.activeTab === last ||
        replacement.tabs[0].id !== replacement.activeTab ||
        replacement.tabs[0].url !== 'about:blank'
      )
        throw new Error('Closing the last native tab did not create a selected blank page.');
      last = replacement.activeTab;
    }
    await driver.setManual!(false);
    await driver.snapshot({ includeImage: false });
  }
};
