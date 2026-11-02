import assert from 'node:assert/strict';
import { setTimeout as delay } from 'node:timers/promises';
import { screen, type BrowserWindow } from 'electron';
import type { NativeGroup } from '../../src/browser/pages.ts';
import { floatingToolbarHeight } from '../../src/browser/floating-layout.ts';

const waitFor = async (check: () => Promise<boolean>, message: string) => {
  for (let attempt = 0; attempt < 100; attempt++) {
    if (await check()) return;
    await delay(20);
  }
  throw new Error(message);
};

/** Real floating preload, compositor input and source navigation; never shows an OS window. */
export const checkFloatingLayout = async (floating: BrowserWindow, group: NativeGroup) => {
  const page = group.pages.get(group.active)!;
  const source = page.contents;
  const read = <T>(expression: string) =>
    floating.webContents.executeJavaScript(expression) as Promise<T>;
  const original = await source.executeJavaScript(
    '({width:innerWidth,height:innerHeight,ratio:devicePixelRatio})',
  );
  const zoom = source.getZoomFactor();
  const outer = floating.getBounds();
  const content = floating.getContentBounds();
  const area = screen.getDisplayMatching(outer).workArea;
  assert.ok(outer.x >= area.x && outer.y >= area.y);
  assert.ok(outer.x + outer.width <= area.x + area.width);
  assert.ok(outer.y + outer.height <= area.y + area.height);
  if (original.height > original.width)
    assert.ok(outer.height > outer.width, 'Tall pages need a tall initial window');
  // A short display can legitimately fit a tall page below 50%. Require the
  // available fit instead, so a fixed landscape window still fails on a big screen.
  const availableScale = Math.min(
    1,
    (Math.floor(area.width * 0.92) - (outer.width - content.width)) / original.width,
    (Math.floor(area.height * 0.92) - (outer.height - content.height) - floatingToolbarHeight) /
      original.height,
  );
  await waitFor(
    () =>
      read(
        `(()=>{const i=document.querySelector('img');return !!i.style.width&&i.getBoundingClientRect().width>0})()`,
      ),
    'The initial floating frame did not finish layout',
  );
  const displayed = await read<{ width: number; height: number }>(
    `(()=>{const r=document.querySelector('img').getBoundingClientRect();return {width:r.width,height:r.height}})()`,
  );
  assert.ok(
    displayed.width >= original.width * availableScale - 1,
    `Initial page did not use the available screen area: ${JSON.stringify({ original, area, outer, content, displayed, availableScale })}`,
  );

  const pointer = (point: { x: number; y: number }) => {
    for (const type of ['mouseDown', 'mouseUp'] as const)
      floating.webContents.sendInputEvent({ type, ...point, button: 'left', clickCount: 1 });
  };
  const button = async (id: string) => {
    pointer(
      await read(
        `(()=>{const r=document.getElementById('${id}').getBoundingClientRect();return {x:Math.round(r.x+r.width/2),y:Math.round(r.y+r.height/2)}})()`,
      ),
    );
  };
  await source.executeJavaScript(`(()=>{
    const link=document.createElement('a');link.id='floating-layout-link';link.href='#floating-readability';link.textContent='Readable link';
    Object.assign(link.style,{position:'fixed',right:'40px',bottom:'40px',padding:'16px',background:'white',color:'black',zIndex:'99999'});
    link.onclick=event=>link.dataset.trusted=String(event.isTrusted);document.body.append(link);
    window.floatingResizeCount=0;addEventListener('resize',()=>window.floatingResizeCount++);
  })()`);
  const sizes = [
    { width: 626, height: 474 },
    { width: 1000, height: 800 },
    { width: 420, height: 600 },
  ];
  for (const size of sizes) {
    floating.setContentSize(size.width, size.height);
    await waitFor(
      () => read(`innerWidth===${size.width}&&innerHeight===${size.height}`),
      'Floating resize did not settle',
    );
    for (const mode of ['fit', 'actual', 'in']) {
      await button(mode);
      await waitFor(
        () =>
          read(
            mode === 'fit'
              ? `document.querySelector('#fit').getAttribute('aria-pressed')==='true'&&document.querySelector('img').getBoundingClientRect().height<=document.querySelector('#surface').clientHeight+1`
              : `document.querySelector('img').getBoundingClientRect().width >= ${original.width} * ${mode === 'actual' ? 0.999 : 1.09}`,
          ),
        `Display ${mode} did not settle`,
      );
      const target = await source.executeJavaScript(
        `(()=>{const r=document.querySelector('#floating-layout-link').getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}})()`,
      );
      await read(
        `(()=>{const s=document.querySelector('#surface'),i=document.querySelector('img'),scale=i.getBoundingClientRect().width/${original.width};s.scrollLeft=${target.x}*scale-s.clientWidth/2;s.scrollTop=${target.y}*scale-s.clientHeight/2})()`,
      );
      const point = await read<{ x: number; y: number }>(
        `(()=>{const r=document.querySelector('img').getBoundingClientRect();return {x:Math.round(r.left+${target.x}*r.width/${original.width}),y:Math.round(r.top+${target.y}*r.height/${original.height})}})()`,
      );
      pointer(point);
      await waitFor(
        async () =>
          source.executeJavaScript(
            `location.hash==='#floating-readability'&&document.querySelector('#floating-layout-link').dataset.trusted==='true'`,
          ),
        `Scaled ${mode} link missed after resize ${size.width}`,
      );
      await source.executeJavaScript(
        `history.replaceState(null,'',location.pathname);delete document.querySelector('#floating-layout-link').dataset.trusted`,
      );
      assert.deepEqual(
        await source.executeJavaScript(
          '({width:innerWidth,height:innerHeight,ratio:devicePixelRatio})',
        ),
        original,
      );
      assert.equal(source.getZoomFactor(), zoom);
      assert.equal(
        await source.executeJavaScript('window.floatingResizeCount'),
        0,
        'Display scaling resized the source',
      );
    }
  }
  // Keyboard users can operate presentation controls without typing into the source.
  // The fixture never focuses an OS window; emulate the focus a visible float has.
  floating.webContents.debugger.attach('1.3');
  await floating.webContents.debugger.sendCommand('Emulation.setFocusEmulationEnabled', {
    enabled: true,
  });
  await read(`document.querySelector('img').focus()`);
  for (const type of ['keyDown', 'keyUp'])
    await floating.webContents.debugger.sendCommand('Input.dispatchKeyEvent', {
      type,
      key: 'F6',
      code: 'F6',
      windowsVirtualKeyCode: 117,
    });
  assert.equal(await read(`document.activeElement.id`), 'fit');
  for (const type of ['keyDown', 'keyUp'])
    await floating.webContents.debugger.sendCommand('Input.dispatchKeyEvent', {
      type,
      key: 'Enter',
      code: 'Enter',
      windowsVirtualKeyCode: 13,
      text: type === 'keyDown' ? '\r' : '',
    });
  await waitFor(
    () => read(`document.querySelector('#fit').getAttribute('aria-pressed')==='true'`),
    'Toolbar keyboard activation failed',
  );
  await source.executeJavaScript(`document.querySelector('#floating-layout-link').remove()`);
  const hidden = !floating.isVisible() && !floating.isFocused();
  assert.equal(hidden, true);
  await button('return');
  await waitFor(
    async () => floating.isDestroyed(),
    'Back to app did not close the floating surface',
  );
  assert.equal(source.isDestroyed(), false);
  assert.equal(group.state().tabs.find((tab) => tab.id === group.active)?.floating, false);
  assert.deepEqual(
    await source.executeJavaScript(
      '({width:innerWidth,height:innerHeight,ratio:devicePixelRatio})',
    ),
    original,
  );
  assert.equal(source.getZoomFactor(), zoom);
  return { viewport: original, sameGuest: true, checks: sizes.length * 3, hidden };
};
