import { BrowserWindow, nativeImage } from 'electron';
import type { NativeGroup } from '../../src/browser/pages.ts';

const floatingWindows = new Map<string, BrowserWindow>();

/** Exercise the production preload and floating preload, with every native window kept hidden. */
export const nativeArtifactFixture = async (
  window: BrowserWindow,
  group: NativeGroup,
  operation: string,
) => {
  const contents = group.pages.get(group.active)!.contents;
  const invoke = (expression: string) => window.webContents.executeJavaScript(expression);
  if (operation === 'capture') {
    const capture = await invoke(`window.pitchcrewBrowser.capture(${JSON.stringify(group.id)})`);
    const point = await contents.executeJavaScript(
      `(()=>{const rect=document.querySelector('#capture-marker').getBoundingClientRect();return {x:rect.x+rect.width/2,y:rect.y+rect.height/2,width:innerWidth}})()`,
    );
    const image = nativeImage.createFromBuffer(Buffer.from(capture.data, 'base64'));
    const size = image.getSize();
    const scale = size.width / point.width;
    const offset = (Math.floor(point.y * scale) * size.width + Math.floor(point.x * scale)) * 4;
    const pixel = Array.from(image.toBitmap({ scaleFactor: 1 }).subarray(offset, offset + 4));
    return { ...capture, marker: pixel[0] < 90 && pixel[1] < 50 && pixel[2] > 200, pixel };
  }
  if (operation === 'floating-open') {
    const existing = new Set(BrowserWindow.getAllWindows().map((item) => item.id));
    await invoke(`window.pitchcrewBrowser.floating(${JSON.stringify(group.id)},true)`);
    const floating = BrowserWindow.getAllWindows().find((item) => !existing.has(item.id))!;
    if (!floating) throw new Error('The floating browser did not create its owned window.');
    floatingWindows.set(group.id, floating);
    await floating.webContents.executeJavaScript(
      `new Promise((resolve,reject)=>{let attempts=0;const check=()=>{const image=document.querySelector('img');if(image.complete&&image.naturalWidth)return resolve(true);if(attempts++>200)return reject(new Error('No live floating frame'));setTimeout(check,20)};check()})`,
    );
    return { hidden: !floating.isVisible() && !floating.isFocused(), contentsId: contents.id };
  }
  if (operation === 'floating-input') {
    const floating = floatingWindows.get(group.id)!;
    const target = await contents.executeJavaScript(
      `(()=>{const button=document.querySelector('#float-target');button.scrollIntoView({block:'center'});const rect=button.getBoundingClientRect();return {x:rect.x+rect.width/2,y:rect.y+rect.height/2,width:innerWidth,height:innerHeight}})()`,
    );
    const position = await floating.webContents.executeJavaScript(
      `(()=>{const rect=document.querySelector('img').getBoundingClientRect();const size=${JSON.stringify(target)};const scale=Math.min(rect.width/size.width,rect.height/size.height);return {x:Math.floor(rect.left+(rect.width-size.width*scale)/2+size.x*scale),y:Math.floor(rect.top+(rect.height-size.height*scale)/2+size.y*scale)}})()`,
    );
    for (const type of ['mouseDown', 'mouseUp'] as const)
      floating.webContents.sendInputEvent({ type, ...position, button: 'left', clickCount: 1 });
    for (let attempt = 0; attempt < 100; attempt++) {
      const text = await contents.executeJavaScript(
        `document.querySelector('#result').textContent`,
      );
      if (text === 'Floating pointer reached same page')
        return {
          text,
          contentsId: contents.id,
          hidden: !floating.isVisible() && !floating.isFocused(),
        };
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
    throw new Error('Floating browser input did not reach the owned DOM guest.');
  }
  if (operation === 'floating-keyboard') {
    const floating = floatingWindows.get(group.id)!;
    const field = await contents.executeJavaScript(
      `(()=>{const field=document.querySelector('#name');field.value='';field.scrollIntoView({block:'center'});const rect=field.getBoundingClientRect();return {x:rect.x+rect.width/2,y:rect.y+rect.height/2,width:innerWidth,height:innerHeight}})()`,
    );
    const point = await floating.webContents.executeJavaScript(
      `(()=>{const rect=document.querySelector('img').getBoundingClientRect();const field=${JSON.stringify(field)};const scale=Math.min(rect.width/field.width,rect.height/field.height);return {x:Math.floor(rect.left+(rect.width-field.width*scale)/2+field.x*scale),y:Math.floor(rect.top+(rect.height-field.height*scale)/2+field.y*scale)}})()`,
    );
    for (const type of ['mouseDown', 'mouseUp'] as const)
      floating.webContents.sendInputEvent({ type, ...point, button: 'left', clickCount: 1 });
    for (let attempt = 0; attempt < 100; attempt++) {
      if (await contents.executeJavaScript(`document.activeElement.id==='name'`)) break;
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
    const sendKeys = (keys: string[]) => {
      for (const keyCode of keys)
        for (const type of ['keyDown', 'keyUp'] as const)
          floating.webContents.sendInputEvent({
            type,
            keyCode,
            modifiers: keyCode === 'M' || keyCode === '!' ? ['shift'] : [],
          });
    };
    sendKeys([...'Mirror', 'Left']);
    let caret: unknown;
    let focusState: unknown;
    for (let attempt = 0; attempt < 100; attempt++) {
      const signal = await contents.executeJavaScript(
        `window.fixtureKeys.some(key=>key.key==='ArrowLeft')`,
      );
      if (signal) {
        await new Promise((resolve) => setTimeout(resolve, 20));
        caret = await contents.executeJavaScript(
          `({start:document.querySelector('#name').selectionStart,end:document.querySelector('#name').selectionEnd,value:document.querySelector('#name').value})`,
        );
        focusState = {
          focusedFrame: contents.focusedFrame?.routingId,
          mainFrame: contents.mainFrame.routingId,
          isFocused: contents.isFocused(),
          document: await contents.executeJavaScript(
            `({hasFocus:document.hasFocus(),active:document.activeElement.id,selection:getSelection().toString()})`,
          ),
        };

        break;
      }
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
    sendKeys(['!', 'Enter']);
    for (let attempt = 0; attempt < 100; attempt++) {
      const result = await contents.executeJavaScript(
        `({value:document.querySelector('#name').value,result:document.querySelector('#result').textContent,keys:window.fixtureKeys})`,
      );
      if (result.value === 'Mirro!r' && result.result === 'Native Enter received')
        return {
          ...result,
          caret,
          hidden: !floating.isVisible() && !floating.isFocused(),
          contentsId: contents.id,
        };
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
    throw new Error(
      `Floating keyboard input did not preserve text, caret navigation and Enter semantics (caret ${JSON.stringify(caret)}, focus ${JSON.stringify(focusState)}): ${JSON.stringify(await contents.executeJavaScript(`({value:document.querySelector('#name').value,result:document.querySelector('#result').textContent,keys:window.fixtureKeys})`))}`,
    );
  }
  if (operation === 'floating-count')
    return BrowserWindow.getAllWindows().filter(
      (item) => [...floatingWindows.values()].includes(item) && !item.isDestroyed(),
    ).length;
  throw new Error('Unknown native artifact fixture operation.');
};
