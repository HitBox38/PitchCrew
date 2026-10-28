import { parseCookieExport } from '../../src/browser/cookie-import.ts';
import { randomUUID } from 'node:crypto';
import { installBrowserComposition } from '../../src/browser/composition.ts';
import { app, BrowserWindow, session, nativeImage } from 'electron';
import { writeFile, readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { createNativeBrowserHost } from '../../src/browser/host.ts';
import { checkNativeBrowserPresentation } from './native-browser-presentation.ts';

if (process.platform === 'darwin') app.setActivationPolicy('accessory');
app.setPath('userData', process.env.PITCHCREW_NATIVE_SMOKE_HOME!);
void app
  .whenReady()
  .then(async () => {
    const window = new BrowserWindow({
      show: false,
      focusable: false,
      skipTaskbar: true,
      width: 1000,
      height: 800,
      webPreferences: { sandbox: true, contextIsolation: true, nodeIntegration: false },
    });
    const { appView } = installBrowserComposition(window);
    let shown = false;
    let focused = false;
    window.on('show', () => {
      shown = true;
    });
    window.on('focus', () => {
      focused = true;
    });
    await window.loadURL('data:text/html,<h1>Native browser fixture</h1>');
    await checkNativeBrowserPresentation(window, appView);
    const host = await createNativeBrowserHost(() => window);
    await writeFile(process.env.PITCHCREW_NATIVE_SMOKE_HOST!, JSON.stringify(host.descriptor));
    const initialized = new Set<number>();
    let last = '';
    let busy = false;
    const timer = setInterval(async () => {
      if (busy) return;
      busy = true;
      try {
        for (const group of host.groups.values())
          for (const page of group.pages.values()) {
            if (
              initialized.has(page.contents.id) ||
              page.contents.isLoading() ||
              !page.contents.getURL()
            )
              continue;
            initialized.add(page.contents.id);
            await page.contents.executeJavaScript(
              `document.title='Native fixture'; document.body.innerHTML='<input id="name"><input id="password" type="password"><button id="go">Continue</button><p id="result">Ready</p><div id="scroller" style="height:80px;overflow:auto"><div style="height:900px">Long form</div></div>'; document.querySelector('#go').onclick=()=>document.querySelector('#result').textContent='Clicked by agent'; void 0;`,
            );
          }
        const text = await readFile(process.env.PITCHCREW_NATIVE_SMOKE_COMMAND!, 'utf8').catch(
          () => '',
        );
        if (!text || text === last) return;
        last = text;
        const command = JSON.parse(text) as { kind: string; id: string; nonce: string };
        const group = host.groups.get(command.id);
        if (command.kind === 'human' && group) {
          host.mount(group.id, { x: 50, y: 100, width: 700, height: 500 });
          const contents = group.pages.get(group.active)!.contents;
          await contents.executeJavaScript(
            `document.querySelector('#name').focus(); document.querySelector('#password').value='fictional-password';`,
          );
          for (const keyCode of 'Human') contents.sendInputEvent({ type: 'char', keyCode });
          const value = await contents.executeJavaScript(`document.querySelector('#name').value`);
          await writeFile(
            process.env.PITCHCREW_NATIVE_SMOKE_RESULT!,
            JSON.stringify({
              nonce: command.nonce,
              value,
              hidden: !shown && !focused && !window.isVisible(),
              nativeViews: window.contentView.children.filter((view) => view !== appView).length,
            }),
          );
        }
        if (command.kind === 'dialog' && group) {
          void group.pages
            .get(group.active)!
            .contents.executeJavaScript(`confirm('Fictional native dialog')`)
            .catch(() => {});
        }
        if (command.kind === 'popup' && group) {
          const contents = group.pages.get(group.active)!.contents;
          const opener = await contents.executeJavaScript(
            `(() => { const child = window.open('about:blank'); return !!child && child.opener === window; })()`,
          );
          await writeFile(
            process.env.PITCHCREW_NATIVE_SMOKE_RESULT!,
            JSON.stringify({
              nonce: command.nonce,
              opener,
              windows: BrowserWindow.getAllWindows().length,
            }),
          );
        }
        if (command.kind === 'mask-check' && group) {
          const point = await group.pages
            .get(group.active)!
            .contents.executeJavaScript(
              `(() => { const rect = document.querySelector('#password').getBoundingClientRect(); return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2, width: innerWidth }; })()`,
            );
          const image = nativeImage.createFromBuffer(
            await readFile(
              join(dirname(process.env.PITCHCREW_NATIVE_SMOKE_RESULT!), 'masked.jpeg'),
            ),
          );
          const size = image.getSize();
          const scale = size.width / point.width;
          const bitmap = image.toBitmap({ scaleFactor: 1 });
          const offset =
            (Math.floor(point.y * scale) * size.width + Math.floor(point.x * scale)) * 4;
          const masked =
            bitmap[offset] > 200 && bitmap[offset + 1] < 80 && bitmap[offset + 2] > 200;
          await writeFile(
            process.env.PITCHCREW_NATIVE_SMOKE_RESULT!,
            JSON.stringify({
              nonce: command.nonce,
              masked,
              size,
              point,
              bitmapBytes: bitmap.length,
              pixel: Array.from(bitmap.subarray(offset, offset + 4)),
            }),
          );
        }
        if (command.kind === 'profiles' && group) {
          const id = randomUUID();
          await host.profiles.update(group.baseProfile, (record) => {
            record.profiles.push({ id, name: 'Work fixture' });
            record.selectedId = id;
          });
          const partition = session.fromPartition(
            `persist:pitchcrew-browser-${host.profiles.partition(group.baseProfile, id)}`,
          );
          const parsed = parseCookieExport(
            JSON.stringify([
              {
                domain: 'example.com',
                path: '/',
                name: 'fixture_session',
                value: 'fictional-profile-cookie',
                secure: true,
                httpOnly: true,
                sameSite: 'Lax',
              },
            ]),
          );
          for (const cookie of parsed.cookies) await partition.cookies.set(cookie);
          await partition.cookies.flushStore();
          const cookies = await partition.cookies.get({ domain: 'example.com' });
          await writeFile(
            process.env.PITCHCREW_NATIVE_SMOKE_RESULT!,
            JSON.stringify({
              nonce: command.nonce,
              profileId: id,
              cookieStored: cookies.some(
                (cookie) => cookie.name === 'fixture_session' && cookie.httpOnly,
              ),
            }),
          );
        }
        if (command.kind === 'quit') {
          clearInterval(timer);
          await host.close();
          window.destroy();
          app.quit();
        }
      } finally {
        busy = false;
      }
    }, 30);
  })
  .catch((error: unknown) => {
    console.error(error);
    app.exit(1);
  });
