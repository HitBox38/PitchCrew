import assert from 'node:assert/strict';
import type { WebContents } from 'electron';
import type { ComputerManager } from '../../../mcp/src/computer.ts';
import type { NativeFixture } from './native-browser-functional.ts';

/** Inject only the unanswered renderer scheduling promise; subsequent paints and copies stay real. */
export const stallNativeMaskPaint = (contents: WebContents) => {
  const original = contents.executeJavaScriptInIsolatedWorld;
  let finish = () => {};
  contents.executeJavaScriptInIsolatedWorld = (...args) => {
    if (args[0] !== 1001) return original.apply(contents, args);
    contents.executeJavaScriptInIsolatedWorld = original;
    return new Promise<void>((resolve) => {
      finish = resolve;
    });
  };
  return () => {
    contents.executeJavaScriptInIsolatedWorld = original;
    finish();
  };
};

/** Same guest, real driver/approval request and credential-mask pixels after a timed-out paint. */
export const checkNativeCaptureRecovery = async (
  manager: ComputerManager,
  scope: { runId: string; roleId: string; cardId: null },
  id: string,
  fixture: NativeFixture,
) => {
  await assert.rejects(
    fixture({ kind: 'mask-paint-timeout', id: 'missing-capture-fixture', operation: 'arm' }),
    /Native capture fixture group not found/,
  );
  await fixture({ kind: 'mask-paint-timeout', id, operation: 'arm' });
  try {
    await assert.rejects(
      manager.request(scope, { kind: 'hover', selector: '#go' }, 'Inspect fixture button'),
      /Native browser capture timed out while waiting for credential masks to paint/,
    );
    const text = await manager.inspect(scope.runId, { includeImage: false });
    assert.equal(text.screenshot, '');
    assert.ok(text.text.includes('Human'));
    const request = await manager.request(
      scope,
      { kind: 'hover', selector: '#go' },
      'Request fresh masked evidence after a paint timeout',
    );
    assert.equal(request.status, 'pending');
    assert.ok(request.page.screenshot.length > 0);
    // Evidence recovery grants no interaction. Leave the action unperformed.
    manager.decide(request.id, false);
    return request.page;
  } finally {
    // Let the obsolete renderer promise settle only after the fresh image succeeds.
    await fixture({ kind: 'mask-paint-timeout', id, operation: 'release' });
  }
};

/**
 * Agent evidence on a scrolled document. Playwright clips a viewport screenshot in document
 * space; the native copy must show what is on screen, credential masks included, rather than
 * read a rect below the view and fail.
 */
export const checkNativeScrolledCapture = async (
  manager: ComputerManager,
  scope: { runId: string; roleId: string; cardId: null },
  id: string,
  fixture: NativeFixture,
) => {
  const scrolled = await fixture<number>({
    kind: 'fixture',
    id,
    before: `document.body.insertAdjacentHTML('beforeend', '<div id="scrolled-form" style="position:absolute;left:0;top:0;width:100%;height:4000px;pointer-events:none"><div id="scrolled-marker" style="position:absolute;left:0;top:1520px;width:100%;height:120px;background:rgb(0,200,0)"></div><input id="scrolled-password" type="password" value="fictional-password" style="position:absolute;left:20px;top:1700px;width:240px;height:48px;pointer-events:auto"></div>'); scrollTo(0, 1500);`,
    expression: 'scrollY',
  });
  assert.equal(scrolled, 1500);
  const pixel = (image: string, selector: string) =>
    fixture<number[]>({ kind: 'frame-pixel', id, image, selector });
  // Bitmaps may be BGRA: green and magenta read the same either way. JPEG evidence shifts
  // colors, so test which channels dominate.
  const green = (value: number[]) => value[1] > 150 && value[0] < 120 && value[2] < 120;
  const magenta = (value: number[]) => value[0] > 200 && value[1] < 80 && value[2] > 200;
  try {
    const inspected = await manager.inspect(scope.runId);
    assert.ok(green(await pixel(inspected.screenshot, '#scrolled-marker')));
    const request = await manager.request(
      scope,
      { kind: 'hover', selector: '#scrolled-marker' },
      'Inspect a control further down the fictional form',
    );
    assert.equal(request.status, 'pending');
    assert.ok(green(await pixel(request.page.screenshot, '#scrolled-marker')));
    const password = await pixel(request.page.screenshot, '#scrolled-password');
    assert.ok(magenta(password), `Scrolled credential was not masked: ${JSON.stringify(password)}`);
    // Evidence only: leave the action unperformed.
    manager.decide(request.id, false);
  } finally {
    await fixture({
      kind: 'fixture',
      id,
      before: `document.querySelector('#scrolled-form')?.remove(); scrollTo(0, 0);`,
      expression: 'scrollY',
    });
  }
};
