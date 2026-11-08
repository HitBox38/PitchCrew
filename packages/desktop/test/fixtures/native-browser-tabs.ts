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
  const waitForActive = async (
    predicate: (tab: Awaited<ReturnType<typeof active>>) => boolean,
    message: string,
  ) => {
    const deadline = Date.now() + 5000;
    let tab = await active();
    while (!predicate(tab) && Date.now() < deadline) {
      await new Promise((resolve) => setTimeout(resolve, 10));
      tab = await active();
    }
    assert.ok(predicate(tab), message);
    return tab;
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
  await waitForActive(
    (tab) => tab.url === recoveredUrl && !tab.error && !tab.loading,
    'The replacement page must finish loading without an error.',
  );
  assert.equal((await active()).navigationUrl, undefined);
  await driver.input!({
    kind: 'navigate',
    url: 'https://8.8.8.8/pitchcrew-native-fixture/unavailable',
  });
  // Navigation acknowledges the document commit, before Chromium necessarily
  // reports a load failure. Wait for the failed load to finish before retrying.
  const unavailable = await waitForActive(
    (tab) => !!tab.error && !tab.loading,
    'The unavailable page must finish with a navigation failure.',
  );
  assert.match(unavailable.navigationUrl!, /unavailable$/);
  await driver.input!({ kind: 'navigate', url: recoveredUrl });
  await waitForActive(
    (tab) => tab.url === recoveredUrl && !tab.error && !tab.loading,
    'The recovered page must finish loading without an error.',
  );
  const slowUrl = 'https://8.8.8.8/pitchcrew-native-fixture/slow';
  const stopped = driver.input!({
    kind: 'navigate',
    url: slowUrl,
  }).catch((error: unknown) => error);
  await waitForActive(
    (tab) => !!tab.loading && tab.navigationUrl === slowUrl,
    'The slow navigation must start before Stop is pressed.',
  );
  await driver.nativeCommand!({ kind: 'stop' });
  assert.ok((await stopped) instanceof Error, 'Stop must cancel an in-flight navigation.');
  await driver.setManual!(false);
  console.log('Native tabs: DNS failure, switching, retry, recovery and Stop passed.');
};
