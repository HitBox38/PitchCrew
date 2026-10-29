import { checkNativeBrowserStreams } from './native-browser-streams.ts';
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { Board } from '../../../board/src/index.ts';
import { reviewFixturePacket } from '../../../board/test/fixtures/application-context.ts';
import { packet } from '../../../board/test/fixtures/packet.ts';
import { cardInput, type BrowserAction, type SubmissionAttempt } from '../../../core/src/index.ts';
import type { ComputerManager } from '../../../mcp/src/computer.ts';
import { exportApprovedPacket } from '../../../mcp/src/index.ts';
import { renderArtifacts } from '../../../packet/src/index.ts';
import { nativeFixtureOrigin, nativeFixturePath } from './native-browser-site.ts';

export interface NativeFixtureCommand {
  kind: string;
  id: string;
  expression?: string;
  image?: string;
  contentsId?: number;
  operation?: string;
  before?: string;
  inputs?: (
    | { type: string; keyCode: string; modifiers?: string[] }
    | { type: string; x: number; y: number; button?: string; clickCount?: number }
  )[];
  bounds?: { x: number; y: number; width: number; height: number };
}
export type NativeFixture = <T>(command: NativeFixtureCommand) => Promise<T>;
const signal = new AbortController().signal;
const authorize = () => {};
const origin = `${nativeFixtureOrigin}${nativeFixturePath}`;

/** Actual ComputerManager approvals, real Playwright/CDP and the same DOM guests used by humans. */
export const checkNativeBrowserFunctionality = async (
  manager: ComputerManager,
  board: Board,
  directory: string,
  fixture: NativeFixture,
  formsOnly = false,
) => {
  const scope = { runId: 'native-functional', roleId: 'scout', cardId: null };
  manager.bindBrowser({ ...scope, threadId: 'native-functional' });
  const driver = await manager.browsers.driver(scope.runId);
  const state = await driver.nativeState!();
  const query = <T>(expression: string, before?: string) =>
    fixture<T>({ kind: 'fixture', id: state.id, expression, before });
  const act = async (action: BrowserAction) => {
    const approval = await manager.request(
      scope,
      action,
      'Exercise fictional native-browser functionality',
    );
    assert.equal(
      (await manager.execute(scope.runId, approval.id, signal, authorize, 0)).status,
      'pending',
    );
    manager.decide(approval.id, true);
    const result = await manager
      .execute(scope.runId, approval.id, signal, authorize, 0)
      .catch((error: unknown) => {
        throw new Error(
          `Native ${action.kind} ${'selector' in action ? action.selector : 'url' in action ? action.url : ''} failed`,
          { cause: error },
        );
      });
    assert.equal(result.status, 'consumed');
    return result;
  };
  const inspectText = () => manager.inspect(scope.runId, { includeImage: false, references: true });
  const waitFor = async (text: string) => {
    const waited = await manager.wait(scope.runId, { text, timeoutMs: 5000 }, signal, authorize);
    if (!waited.matched)
      assert.fail(`Expected native page text ${text}: ${(await manager.inspect(scope.runId, { includeImage: false })).text}
Geometry: ${JSON.stringify(await query(`(()=>{const rect=document.querySelector('#child')?.getBoundingClientRect();return {rect:rect?.toJSON(),at:rect?document.elementFromPoint(rect.x+rect.width/2,rect.y+rect.height/2)?.outerHTML:null,scrollX,scrollY,innerWidth,innerHeight,active:document.activeElement?.outerHTML,frameSignals:window.fixtureFrameSignals}})()`))}
Native input: ${JSON.stringify(await fixture({ kind: 'input-signals', id: state.id }))}`);
  };
  await act({ kind: 'navigate', url: `${origin}/form` });
  await waitFor('Frame continue');
  await assert.rejects(
    driver.perform({ kind: 'navigate', url: 'http://127.0.0.1:4417' }),
    /private network/,
  );
  assert.equal(await query('location.href'), `${origin}/form`);

  await checkNativeBrowserStreams(manager, scope.runId, state.id, fixture);
  const page = await inspectText();
  assert.equal(page.title, 'Fictional native application');
  assert.ok(page.controls?.some((control) => control.label === 'Frame answer' && control.frame));
  assert.ok(
    page.controls?.some(
      (control) => control.label === 'Name' && control.required && control.maxLength === 80,
    ),
  );
  assert.ok(!JSON.stringify(page).includes('fictional-private-password'));
  assert.equal(await manager.resizeBrowser(scope.runId, { width: 390, height: 844 }), true);
  assert.deepEqual(await query(`({width:innerWidth,height:innerHeight})`), {
    width: 390,
    height: 844,
  });
  assert.equal(await manager.resizeBrowser(scope.runId, { width: 1280, height: 800 }), true);
  assert.deepEqual(await query(`({width:innerWidth,height:innerHeight})`), {
    width: 1280,
    height: 800,
  });
  await act({ kind: 'fill', selector: '#name', value: 'Fictional native candidate' });
  await act({ kind: 'press', selector: '#name', key: 'ArrowLeft' });
  assert.equal(
    await query<number>(`document.querySelector('#name').selectionStart`),
    'Fictional native candidate'.length - 1,
    'Approved native arrow keys must move the actual text caret.',
  );

  await act({ kind: 'select', selector: '#location', value: 'onsite' });
  assert.deepEqual(
    await query(
      `({name:document.querySelector('#name').value,location:document.querySelector('#location').value})`,
    ),
    { name: 'Fictional native candidate', location: 'onsite' },
    JSON.stringify(await fixture({ kind: 'input-signals', id: state.id })),
  );
  await act({ kind: 'press', selector: '#name', key: 'Enter' });
  const keys = await query<{
    keys: { key: string; trusted: boolean; target: string }[];
    result: string;
    active: string;
  }>(
    `({keys:window.fixtureKeys,result:document.querySelector('#result').textContent,active:document.activeElement.id})`,
  );
  assert.equal(
    keys.result,
    'Native Enter received',
    JSON.stringify({ keys, signals: await fixture({ kind: 'input-signals', id: state.id }) }),
  );
  await waitFor('Native Enter received');
  assert.ok(keys.keys.some((key) => key.key === 'Enter' && key.trusted && key.target === 'name'));
  await act({ kind: 'drag', selector: '#source', targetSelector: '#destination' });
  await waitFor('Dropped fictional drag');
  await act({
    kind: 'fill',
    selector: '#frame-answer',
    frame: '#child',
    value: 'Fictional iframe answer',
  });
  await act({ kind: 'click', selector: '#frame-go', frame: '#child' });
  await waitFor('Frame interaction received');
  assert.ok(
    (
      await query<{ type: string; target: string; trusted: boolean }[]>(
        'window.fixtureFrameSignals',
      )
    ).some((event) => event.type === 'click' && event.target === 'frame-go' && event.trusted),
  );

  const referenced = (await inspectText()).elements!.find(
    (element) => element.tag === 'button' && element.name === 'Continue',
  )!;
  assert.ok(referenced);
  await act({ kind: 'click', selector: referenced.ref });
  await waitFor('Continued by native agent');
  const old = (await inspectText()).elements!.find(
    (element) => element.tag === 'button' && element.name === 'Continue',
  )!;
  await query(
    `document.querySelector('#continue').replaceWith(document.querySelector('#continue').cloneNode(true));true`,
  );
  await assert.rejects(
    driver.resolveAction!({ kind: 'click', selector: old.ref }),
    /reference changed/,
  );
  await query(
    `true`,
    `setTimeout(()=>{const node=document.createElement('button');node.id='delayed';node.textContent='Delayed native control';document.body.append(node)},100)`,
  );
  await waitFor('Delayed native control');
  assert.deepEqual(
    await manager.wait(
      scope.runId,
      { text: 'Never exists in this fixture', timeoutMs: 100 },
      signal,
      authorize,
    ),
    { matched: false, timedOut: true },
  );
  await query(
    `true`,
    `console.error("TypeError: Cannot read 'fictional-diagnostic-secret'");console.error('arbitrary-private-console')`,
  );
  const diagnostics = (await inspectText()).diagnostics!;
  assert.ok(diagnostics.console.length >= 2);
  assert.ok(!JSON.stringify(diagnostics).includes('fictional-diagnostic-secret'));
  assert.ok(!JSON.stringify(diagnostics).includes('arbitrary-private-console'));

  console.log(
    'Native functionality: form controls, native keys/drag, references and waits passed.',
  );
  if (formsOnly) return;
  const stale = await manager.request(
    scope,
    { kind: 'click', selector: '#continue' },
    'Prove changed native page rejects approved action',
  );
  manager.decide(stale.id, true);
  await query(`document.querySelector('#name').value='Changed outside approval';true`);
  await assert.rejects(
    manager.execute(scope.runId, stale.id, signal, authorize, 0),
    /page changed/,
  );
  await assert.rejects(
    fixture({ kind: 'artifact', id: state.id, operation: 'capture' }),
    /Take control/,
  );
  const downloadAction = await manager.request(
    scope,
    { kind: 'click', selector: '#download' },
    'Prove agent download cannot bypass native manual control',
  );
  manager.decide(downloadAction.id, true);
  await manager
    .execute(scope.runId, downloadAction.id, signal, authorize, 0)
    .catch((error: unknown) => {
      assert.match(String(error), /download|cancel|abort/i);
    });
  const blockedDownloads = await fixture<{ blocked: boolean }[]>({
    kind: 'downloads',
    id: state.id,
  });
  assert.ok(blockedDownloads.some((download) => download.blocked));
  const pending = await manager.request(
    scope,
    { kind: 'click', selector: '#continue' },
    'Prove private takeover expires approved evidence',
  );
  console.log('Native functionality: approvals and denied agent downloads passed.');
  const key = manager.browsers.key(scope.roleId, 'native-functional', null);
  const lease = manager.takeControl(key);
  await manager.syncNativeControl(key, lease);
  await assert.rejects(manager.inspect(scope.runId), /Manual control/);
  await assert.rejects(
    manager.manualInput(key, 'wrong-controller', { kind: 'text', text: 'Denied' }),
    /expired/,
  );
  assert.equal(board.get<{ status: string }>('computer_approval', pending.id).status, 'rejected');
  const typed = await fixture<{ value: string; selection: string }>({
    kind: 'fixture',
    id: state.id,
    bounds: { x: 20, y: 100, width: 1280, height: 800 },
    before: `document.querySelector('#name').focus();document.querySelector('#name').select()`,
    inputs: [...'Human native edit'].map((keyCode) => ({ type: 'char', keyCode })),
    expression: `({value:document.querySelector('#name').value,selection:(()=>{document.querySelector('h1').firstChild&&getSelection().selectAllChildren(document.querySelector('h1'));return getSelection().toString()})()})`,
  });
  assert.equal(typed.value, 'Human native edit');
  assert.equal(typed.selection, 'Fictional native application');
  assert.equal(
    await fixture({ kind: 'input-shield', id: state.id }),
    false,
    'Manual input must reach the real guest.',
  );
  const unzoomed = await query<number>('devicePixelRatio');
  await driver.nativeCommand!({ kind: 'zoom', factor: 1.25 });
  assert.notEqual(
    await query<number>('devicePixelRatio'),
    unzoomed,
    'Native zoom must change actual website rendering scale.',
  );
  await driver.nativeCommand!({ kind: 'zoom', factor: 1 });
  await driver.nativeCommand!({ kind: 'appearance', colorScheme: 'dark' });
  assert.equal(await query(`matchMedia('(prefers-color-scheme: dark)').matches`), true);
  await driver.nativeCommand!({ kind: 'appearance', colorScheme: 'light' });
  assert.equal(await query(`matchMedia('(prefers-color-scheme: dark)').matches`), false);
  await driver.nativeCommand!({ kind: 'appearance', colorScheme: 'system' });
  assert.equal(
    (await driver.nativeCommand!({ kind: 'mute', muted: true })).tabs.find(
      (tab) => tab.id === state.activeTab,
    )?.muted,
    true,
  );
  assert.equal(
    (await driver.nativeCommand!({ kind: 'mute', muted: false })).tabs.find(
      (tab) => tab.id === state.activeTab,
    )?.muted,
    false,
  );
  const capture = await fixture<{
    data: string;
    width: number;
    height: number;
    marker: boolean;
    url: string;
  }>({ kind: 'artifact', id: state.id, operation: 'capture' });
  assert.equal(
    Buffer.from(capture.data, 'base64').subarray(0, 8).toString('hex'),
    '89504e470d0a1a0a',
  );
  assert.equal(capture.width, 1280);
  assert.equal(capture.height, 800);
  assert.equal(capture.marker, true);
  assert.equal(capture.url, `${origin}/form`);
  const floated = await fixture<{ hidden: boolean; contentsId: number }>({
    kind: 'artifact',
    id: state.id,
    operation: 'floating-open',
  });
  assert.equal(floated.hidden, true);
  const floatInput = await fixture<{ hidden: boolean; contentsId: number; text: string }>({
    kind: 'artifact',
    id: state.id,
    operation: 'floating-input',
  });
  assert.equal(floatInput.hidden, true);
  assert.equal(floatInput.contentsId, floated.contentsId);
  assert.equal(floatInput.text, 'Floating pointer reached same page');
  const mirrorKeys = await fixture<{
    value: string;
    result: string;
    hidden: boolean;
    contentsId: number;
    keys: { key: string; trusted: boolean }[];
    caret: { start: number; end: number; value: string };
  }>({ kind: 'artifact', id: state.id, operation: 'floating-keyboard' });
  assert.equal(mirrorKeys.value, 'Mirro!r');
  assert.deepEqual(mirrorKeys.caret, { start: 5, end: 5, value: 'Mirror' });
  assert.equal(mirrorKeys.result, 'Native Enter received');
  assert.equal(mirrorKeys.contentsId, floated.contentsId);
  assert.equal(mirrorKeys.hidden, true);
  assert.ok(mirrorKeys.keys.some((key) => key.key === 'ArrowLeft' && key.trusted));
  assert.ok(mirrorKeys.keys.some((key) => key.key === 'Enter' && key.trusted));

  const downloadPoint = await query<{ x: number; y: number }>(
    `(()=>{const link=document.querySelector('#download');link.scrollIntoView({block:'center'});const box=link.getBoundingClientRect();return {x:Math.floor(box.x+box.width/2),y:Math.floor(box.y+box.height/2)}})()`,
  );
  await fixture({
    kind: 'fixture',
    id: state.id,
    inputs: [
      { type: 'mouseDown', ...downloadPoint, button: 'left', clickCount: 1 },
      { type: 'mouseUp', ...downloadPoint, button: 'left', clickCount: 1 },
    ],
  });
  let completedDownloads: { blocked: boolean; state?: string; bytes?: number[] }[] = [];
  for (let attempt = 0; attempt < 100; attempt++) {
    completedDownloads = await fixture({ kind: 'downloads', id: state.id });
    if (completedDownloads.some((download) => !download.blocked && download.bytes)) break;
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  const downloaded = completedDownloads.find((download) => !download.blocked && download.bytes)!;
  assert.ok(downloaded, 'Manual native download did not complete.');
  assert.equal(downloaded.state, 'completed');
  assert.equal(Buffer.from(downloaded.bytes!).toString(), 'Fictional native download bytes');
  const found = await fixture<{ matches: number; activeMatchOrdinal: number }>({
    kind: 'find',
    id: state.id,
  });
  assert.ok(found.matches > 0);
  const nextFound = await fixture<{ matches: number; activeMatchOrdinal: number }>({
    kind: 'find',
    id: state.id,
  });
  assert.equal(nextFound.matches, found.matches);
  assert.notEqual(nextFound.activeMatchOrdinal, found.activeMatchOrdinal);

  console.log(
    'Native functionality: private input, screenshot, floating pointer, manual download and Find passed.',
  );
  await query(
    `document.cookie='fictional_profile=native-session; Path=/; Secure; SameSite=Lax';true`,
  );
  await manager.manualInput(key, lease, { kind: 'navigate', url: `${origin}/next` });
  assert.ok(
    (await driver.nativeState!()).tabs.find((tab) => tab.id === state.activeTab)?.canGoBack,
  );
  await driver.nativeCommand!({ kind: 'back' });
  assert.equal((await query<{ url: string }>(`({url:location.href})`)).url, `${origin}/form`);
  await driver.nativeCommand!({ kind: 'forward' });
  await query(`document.title`);
  assert.equal(
    (await driver.nativeState!()).tabs.find((tab) => tab.id === state.activeTab)?.url,
    `${origin}/next`,
  );
  const firstDocument = await query<number>('performance.timeOrigin');
  await driver.nativeCommand!({ kind: 'reload' });
  const reloaded = await query<number>('performance.timeOrigin');
  assert.notEqual(reloaded, firstDocument);
  await driver.nativeCommand!({ kind: 'hard-reload' });
  assert.notEqual(await query<number>('performance.timeOrigin'), reloaded);
  await manager.manualInput(key, lease, { kind: 'navigate', url: `${origin}/redirect` });
  assert.equal(await query<string>('location.href'), `${origin}/next`);
  const slow = manager
    .manualInput(key, lease, { kind: 'navigate', url: `${origin}/slow` })
    .catch((error: unknown) => error);
  for (let attempt = 0; attempt < 100; attempt++) {
    if ((await driver.nativeState!()).tabs.find((tab) => tab.id === state.activeTab)?.loading)
      break;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  await driver.nativeCommand!({ kind: 'stop' });
  assert.ok(
    (await slow) instanceof Error,
    'Stopping a real in-flight native navigation must cancel its request.',
  );
  await manager.manualInput(key, lease, { kind: 'navigate', url: `${origin}/form` });

  console.log('Native functionality: navigation, history, reload, redirect and Stop passed.');
  const otherScope = { runId: 'native-independent', roleId: 'scout', cardId: null };
  manager.bindBrowser({ ...otherScope, threadId: 'native-independent' });
  const otherDriver = await manager.browsers.driver(otherScope.runId);
  await otherDriver.perform({ kind: 'navigate', url: `${origin}/next` });
  assert.ok(
    (await manager.inspect(otherScope.runId, { includeImage: false })).text.includes(
      'Fictional next page',
    ),
  );
  const otherId = (await otherDriver.nativeState!()).id;
  assert.match(
    await fixture<string>({ kind: 'fixture', id: otherId, expression: 'document.cookie' }),
    /fictional_profile=native-session/,
  );

  await assert.rejects(manager.tabs(scope.runId, { kind: 'list' }), /Manual control/);
  const currentLease = manager.browsers.forRole(key);
  currentLease.lease!.until = Date.now() - 1;
  await assert.rejects(manager.returnControl(key, lease), /expired/);
  await assert.rejects(manager.inspect(scope.runId), /Manual control/);
  const replacement = manager.takeControl(key);
  await manager.syncNativeControl(key, replacement);
  await manager.returnControl(key, replacement);
  assert.equal(
    await fixture({ kind: 'input-shield', id: state.id }),
    true,
    'The actual DOM hit target must block human input while an agent owns the selected guest.',
  );
  await waitFor('Fictional native application');
  await assert.rejects(driver.targetTab!((await otherDriver.nativeState!()).activeTab), /outside/);

  const originalDocument = await fixture<number>({
    kind: 'fixture',
    id: otherId,
    expression: 'performance.timeOrigin',
  });
  const sameDocumentApproval = await manager.request(
    otherScope,
    { kind: 'click', selector: 'a' },
    'Prove identical native reload cannot reuse approved evidence',
  );
  manager.decide(sameDocumentApproval.id, true);
  await fixture({
    kind: 'fixture',
    id: otherId,
    before: 'setTimeout(()=>location.reload(),10);true',
    expression: 'true',
  });
  let replacementDocument = originalDocument;
  for (let attempt = 0; replacementDocument === originalDocument && attempt < 100; attempt++) {
    replacementDocument = await fixture<number>({
      kind: 'fixture',
      id: otherId,
      expression: 'performance.timeOrigin',
    });
    if (replacementDocument === originalDocument)
      await new Promise((resolve) => setTimeout(resolve, 20));
  }
  assert.notEqual(replacementDocument, originalDocument);
  await assert.rejects(
    manager.execute(otherScope.runId, sameDocumentApproval.id, signal, authorize, 0),
    /page changed/,
  );
  await act({ kind: 'click', selector: '#new-tab' });
  let linked = await driver.nativeState!();
  for (let attempt = 0; linked.tabs.length < 2 && attempt < 100; attempt++) {
    await new Promise((resolve) => setTimeout(resolve, 20));
    linked = await driver.nativeState!();
  }
  assert.equal(linked.tabs.length, 2);
  assert.ok(
    !linked.tabs.find((tab) => tab.id !== state.activeTab)?.window,
    'Ordinary target=_blank links should stay embedded.',
  );
  await manager.tabs(scope.runId, { kind: 'select', tabId: state.activeTab });
  await act({ kind: 'click', selector: '#popup' });
  await manager.wait(
    scope.runId,
    { text: 'Complete fictional sign in', timeoutMs: 5000 },
    signal,
    authorize,
  );
  const popupState = await driver.nativeState!();
  assert.equal(popupState.tabs.filter((tab) => tab.window).length, 1);
  await act({ kind: 'click', selector: '#complete' });
  await manager.tabs(scope.runId, { kind: 'select', tabId: state.activeTab });
  await waitFor('Popup opener message received');
  const tab = linked.tabs.find((tab) => tab.id !== state.activeTab)!;
  await manager.tabs(scope.runId, { kind: 'close', tabId: tab.id });
  await assert.rejects(driver.targetTab!(tab.id), /outside|closed/);

  console.log(
    'Native functionality: independent scopes, exact leases and owned tabs/popups passed.',
  );
  const tabStep = async <T>(label: string, operation: Promise<T>) =>
    operation.catch((error: unknown) => {
      throw new Error(`Native tab operation ${label} failed: ${String(error)}`, { cause: error });
    });
  const lastTabOriginal = (await otherDriver.nativeState!()).activeTab;
  const lastTabKey = manager.browsers.key(otherScope.roleId, 'native-independent', null);
  const firstExtra = await tabStep('firstExtra', manager.tabs(otherScope.runId, { kind: 'open' }));
  const backgroundTab = firstExtra.tabs.find((tab) => tab.active)!.id;
  const secondExtra = await tabStep(
    'secondExtra',
    manager.tabs(otherScope.runId, { kind: 'open' }),
  );
  const activeExtra = secondExtra.tabs.find((tab) => tab.active)!.id;
  const backgroundClosed = await tabStep(
    'backgroundClosed',
    manager.tabs(otherScope.runId, {
      kind: 'close',
      tabId: backgroundTab,
    }),
  );
  assert.equal(backgroundClosed.tabs.length, 2);
  assert.equal(backgroundClosed.tabs.find((tab) => tab.active)!.id, activeExtra);
  const activeClosed = await tabStep(
    'activeClosed',
    manager.tabs(otherScope.runId, { kind: 'close', tabId: activeExtra }),
  );
  assert.equal(activeClosed.tabs.length, 1);
  assert.equal(activeClosed.tabs[0].id, lastTabOriginal);
  const finalClosed = await tabStep(
    'finalClosed',
    manager.tabs(otherScope.runId, {
      kind: 'close',
      tabId: lastTabOriginal,
    }),
  );
  assert.equal(finalClosed.tabs.length, 1);
  assert.notEqual(finalClosed.tabs[0].id, lastTabOriginal);
  const actualBlankUrl = await fixture<string>({
    kind: 'fixture',
    id: otherId,
    expression: 'location.href',
  });
  const settledBlankState = await otherDriver.nativeState!();
  assert.equal(
    finalClosed.tabs[0].url,
    'about:blank',
    JSON.stringify({ first: finalClosed, actualBlankUrl, settled: settledBlankState }),
  );
  assert.equal(
    actualBlankUrl,
    'about:blank',
    'The replacement must be a genuine ready blank document, not its internal bootstrap URL.',
  );
  assert.equal(
    settledBlankState.tabs[0].canGoBack,
    false,
    'New blank tabs must not expose bootstrap navigation history.',
  );

  const closeLease = manager.takeControl(lastTabKey);
  await manager.syncNativeControl(lastTabKey, closeLease);
  const humanNew = await tabStep('humanNew', otherDriver.nativeCommand!({ kind: 'new-tab' }));
  assert.equal(humanNew.tabs.length, 2);
  const humanClosed = await tabStep(
    'humanClosed',
    otherDriver.nativeCommand!({
      kind: 'close-tab',
      tabId: humanNew.activeTab,
    }),
  );
  assert.equal(humanClosed.tabs.length, 1);
  const concurrentCapture = otherDriver.frame!().then(
    () => ({ captured: true, error: '' }),
    (error: unknown) => ({ captured: false, error: String(error) }),
  );
  const humanLastClosed = await tabStep(
    'humanLastClosed',
    otherDriver.nativeCommand!({
      kind: 'close-tab',
      tabId: humanClosed.activeTab,
    }),
  );
  const captureOutcome = await concurrentCapture;
  assert.ok(
    captureOutcome.captured ||
      (!/timed out|timeout|crash|finishing a capture/i.test(captureOutcome.error) &&
        /closed|changed|target|session|native browser/i.test(captureOutcome.error)),
    captureOutcome.error,
  );
  assert.equal(humanLastClosed.tabs.length, 1);
  assert.notEqual(humanLastClosed.activeTab, humanClosed.activeTab);
  assert.equal(humanLastClosed.tabs[0].url, 'about:blank');
  assert.equal(
    await fixture({ kind: 'fixture', id: otherId, expression: 'location.href' }),
    'about:blank',
  );
  assert.equal((await otherDriver.nativeState!()).tabs[0].canGoBack, false);
  await manager.returnControl(lastTabKey, closeLease);
  console.log(
    'Native functionality: agent and human background/active/last-tab close and blank replacement passed.',
  );
  await checkNativePacketUpload(manager, board, directory, fixture);
  console.log(
    'Native functionality: exact reviewed PDF/DOCX upload and submission receipt passed.',
  );
  const recoveryStep = async <T>(name: string, operation: Promise<T>) => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      return await Promise.race([
        operation,
        new Promise<never>((_resolve, reject) => {
          timer = setTimeout(
            () => reject(new Error(`Native crash recovery stalled at ${name}`)),
            15000,
          );
        }),
      ]);
    } finally {
      clearTimeout(timer);
    }
  };
  const beforeCrashTab = state.activeTab;
  const beforeCrashState = await driver.nativeState!();
  const recoverLease = manager.takeControl(key);
  await recoveryStep('enable private control', manager.syncNativeControl(key, recoverLease));
  await recoveryStep('crash the native renderer', fixture({ kind: 'crash', id: state.id }));
  assert.match(
    (await recoveryStep('read crash metadata', driver.nativeState!())).tabs.find(
      (tab) => tab.id === state.activeTab,
    )!.error!,
    /stopped responding/,
  );
  const recoveredState = await recoveryStep(
    'reload and attach the recovered page',
    driver.nativeCommand!({ kind: 'reload' }),
  );
  assert.equal(recoveredState.id, state.id);
  assert.deepEqual(recoveredState.profile, beforeCrashState.profile);
  assert.equal(recoveredState.tabs.length, beforeCrashState.tabs.length);
  assert.notEqual(
    recoveredState.activeTab,
    beforeCrashTab,
    'Crash recovery must create a fresh browser target.',
  );
  const recoveredGuest = await fixture<{ contentsId: number; oldAlive: boolean }>({
    kind: 'guest-lifecycle',
    id: state.id,
    contentsId: floated.contentsId,
  });
  assert.notEqual(recoveredGuest.contentsId, floated.contentsId);
  assert.equal(recoveredGuest.oldAlive, false);
  await assert.rejects(driver.targetTab!(beforeCrashTab), /outside|closed/);
  state.activeTab = recoveredState.activeTab;

  await recoveryStep('read the recovered native document', query('document.title'));
  assert.match(await query<string>('document.cookie'), /fictional_profile=native-session/);
  assert.equal(await fixture({ kind: 'artifact', id: state.id, operation: 'floating-count' }), 0);
  await recoveryStep('return private control', manager.returnControl(key, recoverLease));
  await recoveryStep('inspect the recovered page', waitFor('Fictional native application'));
  assert.ok(!(await driver.nativeState!()).tabs.find((tab) => tab.id === state.activeTab)!.error);

  console.log('Native functionality: crash recovery passed.');

  await manager.stop(scope.runId);
  await manager.browsers.closeRole(key);
  assert.equal(await fixture({ kind: 'artifact', id: otherId, operation: 'floating-count' }), 0);
  const reopenedScope = { ...scope, runId: 'native-functional-reopened' };
  manager.bindBrowser({ ...reopenedScope, threadId: 'native-functional' });
  const reopened = await manager.browsers.driver(reopenedScope.runId);
  await reopened.perform({ kind: 'navigate', url: `${origin}/next` });
  assert.match(
    await fixture<string>({
      kind: 'fixture',
      id: (await reopened.nativeState!()).id,
      expression: 'document.cookie',
    }),
    /fictional_profile=native-session/,
  );

  const beforeReload = await manager.request(
    reopenedScope,
    { kind: 'click', selector: 'a' },
    'Prove renderer reload invalidates exact old-page approval',
  );
  const rendererReloaded = await fixture<{ closed: boolean; groups: number; guests: number }>({
    kind: 'renderer-reload',
    id: (await reopened.nativeState!()).id,
  });
  assert.deepEqual(rendererReloaded, { closed: true, groups: 0, guests: 0 });
  for (
    let attempt = 0;
    attempt < 100 &&
    board.get<{ status: string }>('computer_approval', beforeReload.id).status === 'pending';
    attempt++
  )
    await new Promise((resolve) => setTimeout(resolve, 20));
  assert.equal(
    board.get<{ status: string }>('computer_approval', beforeReload.id).status,
    'rejected',
  );
  await assert.rejects(manager.inspect(reopenedScope.runId), /ended|closed|unavailable/);
  const afterReloadScope = { ...scope, runId: 'native-after-renderer-reload' };
  manager.bindBrowser({ ...afterReloadScope, threadId: 'native-after-renderer-reload' });
  const afterReload = await manager.browsers.driver(afterReloadScope.runId);
  await afterReload.perform({ kind: 'navigate', url: `${origin}/next` });
  assert.match(
    (await manager.inspect(afterReloadScope.runId, { includeImage: false })).text,
    /Fictional next page/,
  );
  assert.match(
    await fixture<string>({
      kind: 'fixture',
      id: (await afterReload.nativeState!()).id,
      expression: 'document.cookie',
    }),
    /fictional_profile=native-session/,
  );
  console.log(
    'Native functional workflows passed: navigation/history/redirect/reload/stop, trusted human editing/selection, form actions/drag/iframe, references/waits/diagnostics, approval invalidation, private leases and independent scopes, linked tabs/popups, crash recovery and exact reviewed packet upload/submission.',
  );
};

const checkNativePacketUpload = async (
  manager: ComputerManager,
  board: Board,
  directory: string,
  fixture: NativeFixture,
) => {
  const card = board.createCard(
    cardInput.parse({ company: 'Fictional Native Studio', title: 'Engineer' }),
  );
  for (const status of ['shortlisted', 'drafting'] as const) board.move(card.id, status, 'user');
  board.updateCard(
    card.id,
    { packet },
    'writer',
    'Create fictional reviewed native-browser packet',
  );
  for (const status of ['in_review', 'agreed'] as const) board.move(card.id, status, 'reviewer');
  reviewFixturePacket(board, card.id);
  const exported = board.requestApproval(card.id, await renderArtifacts(packet, ['pdf', 'docx']));
  board.decideApproval(exported.id, true);
  const output = await exportApprovedPacket(board, directory, exported.id);
  const scope = { runId: 'native-packet-upload', roleId: 'reviewer', cardId: card.id };
  manager.bindBrowser({ ...scope, threadId: 'native-packet-upload' });
  const driver = await manager.browsers.driver(scope.runId);
  const id = (await driver.nativeState!()).id;
  const opened = await manager.request(
    scope,
    { kind: 'navigate', url: `${origin}/form` },
    'Open fictional application through the native approval gate',
  );
  manager.decide(opened.id, true);
  await manager.execute(scope.runId, opened.id, signal, authorize, 0);
  const openedPage = await manager.inspect(scope.runId, { includeImage: false });
  assert.equal(openedPage.title, 'Fictional native application');
  assert.ok(
    openedPage.controls?.some((control) => control.type === 'file' && control.label === 'Resume'),
  );

  assert.ok(
    !(await fixture<string>({ kind: 'fixture', id, expression: 'document.cookie' })).includes(
      'fictional_profile',
    ),
    'Different roles must not share browser sign-ins.',
  );
  for (const file of ['resume.pdf', 'resume.docx'] as const) {
    const before = await fixture<unknown>({
      kind: 'fixture',
      id,
      expression: `document.querySelector('#resume').files.length`,
    });
    const approval = await manager.request(
      scope,
      { kind: 'upload', selector: '#resume', file, exportApprovalId: exported.id },
      `Upload exact fictional reviewed ${file}`,
    );
    assert.equal(
      (await manager.execute(scope.runId, approval.id, signal, authorize, 0)).status,
      'pending',
    );
    assert.equal(
      await fixture({
        kind: 'fixture',
        id,
        expression: `document.querySelector('#resume').files.length`,
      }),
      before,
    );
    manager.decide(approval.id, true);
    assert.equal(
      (await manager.execute(scope.runId, approval.id, signal, authorize, 0)).status,
      'consumed',
    );
    const received = await fixture<{ name: string; type: string; bytes: number[] }>({
      kind: 'fixture',
      id,
      expression: `(async()=>{const file=document.querySelector('#resume').files[0];return {name:file.name,type:file.type,bytes:Array.from(new Uint8Array(await file.arrayBuffer()))}})()`,
    });
    assert.equal(received.name, file);
    assert.equal(
      received.type,
      file.endsWith('.pdf')
        ? 'application/pdf'
        : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    );
    assert.deepEqual(Buffer.from(received.bytes), await readFile(join(output, file)));
  }
  const approval = await manager.request(
    scope,
    { kind: 'upload', selector: '#resume', file: 'resume.pdf', exportApprovalId: exported.id },
    'Prove changed exported bytes cannot reach native input',
  );
  manager.decide(approval.id, true);
  const original = await readFile(join(output, 'resume.pdf'));
  await writeFile(join(output, 'resume.pdf'), Buffer.from('tampered fictional bytes'));
  await assert.rejects(
    manager.execute(scope.runId, approval.id, signal, authorize, 0),
    /file changed/,
  );
  assert.equal(
    await fixture({
      kind: 'fixture',
      id,
      expression: `document.querySelector('#resume').files[0].name`,
    }),
    'resume.docx',
  );
  await writeFile(join(output, 'resume.pdf'), original);
  const fill = await manager.request(
    scope,
    { kind: 'fill', selector: '#name', value: 'Example candidate' },
    'Use reviewed candidate name',
  );
  manager.decide(fill.id, true);
  await manager.execute(scope.runId, fill.id, signal, authorize, 0);
  const submit = await manager.request(
    scope,
    { kind: 'click', selector: '#submit', purpose: 'submission', exportApprovalId: exported.id },
    'Submit fictional application to intercepted local fixture',
  );
  assert.equal(
    (await manager.execute(scope.runId, submit.id, signal, authorize, 0)).status,
    'pending',
  );
  assert.deepEqual(
    await fixture({
      kind: 'fixture',
      id,
      expression: `fetch('${nativeFixturePath}/receipts').then(response=>response.json())`,
    }),
    [],
  );
  manager.decide(submit.id, true);
  await manager.execute(scope.runId, submit.id, signal, authorize, 0);
  assert.deepEqual(
    await manager.wait(
      scope.runId,
      { text: 'Application received FICTION-NATIVE-123', timeoutMs: 5000 },
      signal,
      authorize,
    ),
    { matched: true },
  );
  const receipts = await fixture<{ name: string; file: { bytes: number[] } }[]>({
    kind: 'fixture',
    id,
    expression: `fetch('${nativeFixturePath}/receipts').then(response=>response.json())`,
  });
  assert.equal(receipts.length, 1);
  assert.equal(receipts[0].name, 'Example candidate');
  assert.deepEqual(
    Buffer.from(receipts[0].file.bytes),
    await readFile(join(output, 'resume.docx')),
  );
  const attempt = board
    .list<SubmissionAttempt>('submission_attempt')
    .find((item) => item.runId === scope.runId)!;
  assert.equal(attempt.status, 'uncertain');
  await manager.capture(scope, attempt.id, 'Application received FICTION-NATIVE-123');
  await assert.rejects(
    manager.request(scope, { kind: 'click', selector: '#submit' }, 'Duplicate native submission'),
    /uncertain|verify|submission/,
  );
  assert.equal(
    (
      await fixture<unknown[]>({
        kind: 'fixture',
        id,
        expression: `fetch('${nativeFixturePath}/receipts').then(response=>response.json())`,
      })
    ).length,
    1,
  );
};
