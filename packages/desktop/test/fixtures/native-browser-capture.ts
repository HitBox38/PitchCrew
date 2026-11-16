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
