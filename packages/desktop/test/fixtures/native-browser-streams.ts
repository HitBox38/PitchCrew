import assert from 'node:assert/strict';
import type { BrowserFrame } from '../../../core/src/index.ts';
import type { ComputerManager } from '../../../mcp/src/computer.ts';
import type { NativeFixture } from './native-browser-functional.ts';

export const checkNativeBrowserStreams = async (
  manager: ComputerManager,
  runId: string,
  id: string,
  fixture: NativeFixture,
) => {
  const bounded = async <T>(operation: Promise<T>) => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      return await Promise.race([
        operation,
        new Promise<never>((_resolve, reject) => {
          timer = setTimeout(
            () => reject(new Error('Native live frame delivery timed out.')),
            10000,
          );
        }),
      ]);
    } finally {
      clearTimeout(timer);
    }
  };
  const firstAbort = new AbortController();
  const secondAbort = new AbortController();
  const first = manager.browsers.watchFrames(runId, firstAbort.signal);
  const second = manager.browsers.watchFrames(runId, secondAbort.signal);
  const nextImage = async (viewer: AsyncGenerator<BrowserFrame>) => {
    for (;;) {
      const frame = await viewer.next();
      if (frame.done || frame.value.screenshot.length > 100) return frame;
    }
  };
  try {
    const [one, two] = await bounded(Promise.all([nextImage(first), nextImage(second)]));
    assert.ok(!one.done && one.value.screenshot.length > 100);
    assert.ok(!two.done && two.value.screenshot.length > 100);
    const originalPixel = await fixture<number[]>({
      kind: 'frame-pixel',
      id,
      image: one.value!.screenshot,
    });
    assert.ok(
      originalPixel[0] < 90 && originalPixel[1] < 60 && originalPixel[2] > 190,
      'Initial live frame must contain the real pink page marker.',
    );
    const before = await fixture<{ frames: number; painting: boolean }>({
      kind: 'stream-state',
      id,
    });
    assert.ok(before.frames > 0, 'The native stream must deliver real CDP screencast events.');
    assert.equal(before.painting, true);
    assert.ok((await manager.inspect(runId)).screenshot.length > 100);
    firstAbort.abort();
    await first.return(undefined);
    const next = nextImage(second);
    await fixture({
      kind: 'fixture',
      id,
      expression: `document.querySelector('#capture-marker').style.background='rgb(20,40,240)';true`,
    });
    let updated = await bounded(next);
    assert.ok(
      !updated.done && updated.value.screenshot.length > 100,
      'Closing one viewer must leave the other viewer live.',
    );
    let changed = false;
    const deadline = Date.now() + 5000;
    while (!updated.done && Date.now() < deadline) {
      const pixel = await fixture<number[]>({
        kind: 'frame-pixel',
        id,
        image: updated.value.screenshot,
      });
      if (pixel[0] > 190 && pixel[1] < 90 && pixel[2] < 90) {
        changed = true;
        break;
      }
      updated = await bounded(nextImage(second));
    }
    assert.equal(changed, true, 'The surviving native viewer must receive changed website pixels.');
    secondAbort.abort();
    await second.return(undefined);
    await fixture({
      kind: 'fixture',
      id,
      expression: `new Promise(resolve=>setTimeout(()=>{document.querySelector('#capture-marker').style.background='rgb(240,20,70)';resolve(true)},500))`,
    });
    const stopped = await fixture<{ frames: number; painting: boolean }>({
      kind: 'stream-state',
      id,
    });
    assert.equal(
      stopped.painting,
      false,
      'The final viewer must release its native painting lease.',
    );
    await fixture({
      kind: 'fixture',
      id,
      expression: 'new Promise(resolve=>setTimeout(()=>resolve(true),250))',
    });
    const quiet = await fixture<{ frames: number; painting: boolean }>({
      kind: 'stream-state',
      id,
    });
    assert.equal(
      quiet.frames,
      stopped.frames,
      'Native screencast events must stop after the last viewer leaves.',
    );
  } finally {
    firstAbort.abort();
    secondAbort.abort();
    await Promise.all([first.return(undefined), second.return(undefined)]);
  }
};
