import type { BrowserDriver } from '../../../mcp/src/computer/types.ts';
import assert from 'node:assert/strict';

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
  await driver.setManual!(true);
  const failedUrl = 'https://pitchcrew-browser-test.invalid/';
  const failedTab = (await driver.nativeState!()).activeTab;
  const active = async () => {
    const state = await driver.nativeState!();
    return state.tabs.find((tab) => tab.id === state.activeTab)!;
  };
  await driver.input!({ kind: 'navigate', url: failedUrl });
  assert.equal((await active()).navigationUrl, failedUrl);
  assert.equal((await active()).url, 'about:blank');
  assert.match((await active()).errorDetails!, /ENOTFOUND/);
  await driver.nativeCommand!({ kind: 'new-tab' });
  assert.equal((await active()).error, undefined);
  await driver.nativeCommand!({ kind: 'select-tab', tabId: failedTab });
  assert.equal((await active()).navigationUrl, failedUrl);
  assert.ok((await active()).error);
  await driver.nativeCommand!({ kind: 'reload' });
  assert.equal((await active()).navigationUrl, failedUrl);
  assert.match((await active()).errorDetails!, /ENOTFOUND/);
  const recoveredUrl = 'https://8.8.8.8/pitchcrew-native-fixture/next';
  await driver.input!({ kind: 'navigate', url: recoveredUrl });
  assert.equal((await active()).url, recoveredUrl);
  assert.equal((await active()).error, undefined);
  assert.equal((await active()).navigationUrl, undefined);
  await driver.input!({
    kind: 'navigate',
    url: 'https://8.8.8.8/pitchcrew-native-fixture/unavailable',
  });
  assert.ok((await active()).error);
  assert.match((await active()).navigationUrl!, /unavailable$/);
  await driver.input!({ kind: 'navigate', url: recoveredUrl });
  assert.equal((await active()).error, undefined);
  assert.equal((await active()).url, recoveredUrl);
  const stopped = driver.input!({
    kind: 'navigate',
    url: 'https://8.8.8.8/pitchcrew-native-fixture/slow',
  }).catch((error: unknown) => error);
  for (let attempt = 0; attempt < 100; attempt++) {
    if ((await active()).loading) break;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  await driver.nativeCommand!({ kind: 'stop' });
  assert.ok((await stopped) instanceof Error, 'Stop must cancel an in-flight navigation.');
  await driver.setManual!(false);
  console.log('Native tabs: DNS failure, switching, retry, recovery and Stop passed.');
};
