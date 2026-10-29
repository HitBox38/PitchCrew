import { nativeArtifactFixture } from './native-browser-artifacts.ts';
import { installNativeFixtureSite, nativeFixtureDownloads } from './native-browser-site.ts';
import { parseCookieExport } from '../../src/browser/cookie-import.ts';
import { randomUUID } from 'node:crypto';
import { app, BrowserWindow, session, nativeImage, webContents } from 'electron';
import { writeFile, readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { once } from 'node:events';
import { createNativeBrowserHost, installNativeBrowserIpc } from '../../src/browser/host.ts';
import { checkNativeBrowserPresentation } from './native-browser-presentation.ts';

if (process.platform === 'darwin') app.setActivationPolicy('accessory');
app.setPath('userData', process.env.PITCHCREW_NATIVE_SMOKE_HOME!);
// Finish owned-resource teardown before quitting the isolated Electron process.
app.on('window-all-closed', () => {});
void app
  .whenReady()
  .then(async () => {
    const window = new BrowserWindow({
      show: false,
      focusable: false,
      skipTaskbar: true,
      width: 1440,
      height: 1000,
      webPreferences: {
        preload: fileURLToPath(new URL('./preload.cjs', import.meta.url)),
        sandbox: true,
        contextIsolation: true,
        nodeIntegration: false,
        webviewTag: true,
        backgroundThrottling: false,
      },
    });
    const host = await createNativeBrowserHost(
      () => window,
      () => 'null',
    );
    host.dom.install(window);
    installNativeBrowserIpc(
      host,
      () => window,
      () => 'null',
    );

    let shown = false;
    let focused = false;
    window.on('show', () => {
      shown = true;
    });
    window.on('focus', () => {
      focused = true;
    });
    app.on('browser-window-created', (_event, created) => {
      created.on('show', () => {
        shown = true;
      });
      created.on('focus', () => {
        focused = true;
      });
    });
    await window.loadURL(
      'data:text/html,' +
        encodeURIComponent(
          '<!doctype html><html><head><meta charset="utf-8"><style>html,body{margin:0;background:rgb(242,241,236)}#app{position:fixed;inset:0;z-index:0;background:rgb(242,241,236)}</style></head><body><main id="app"><h1>Native browser fixture</h1></main></body></html>',
        ),
    );
    await window.webContents.executeJavaScript(
      await readFile(fileURLToPath(new URL('./renderer.iife.js', import.meta.url)), 'utf8'),
    );
    await writeFile(process.env.PITCHCREW_NATIVE_SMOKE_HOST!, JSON.stringify(host.descriptor));
    const initialized = new Set<number>();
    const inputSignals = new Map<number, unknown[]>();
    const streamFrames = new Map<number, number>();
    let last = '';
    let busy = false;
    const timer = setInterval(async () => {
      if (busy) return;
      busy = true;
      let commandNonce = '';
      let commandKind = '';
      let commandId = '';
      try {
        for (const group of host.groups.values())
          for (const page of group.pages.values()) {
            installNativeFixtureSite(
              page.contents.session,
              dirname(process.env.PITCHCREW_NATIVE_SMOKE_RESULT!),
            );
            if (!inputSignals.has(page.contents.id)) {
              inputSignals.set(page.contents.id, []);
              streamFrames.set(page.contents.id, 0);
              page.contents.debugger.on('message', (_event, method) => {
                if (method === 'Page.screencastFrame')
                  streamFrames.set(page.contents.id, (streamFrames.get(page.contents.id) ?? 0) + 1);
              });

              page.contents.on('before-input-event', (event, input) => {
                const signals = inputSignals.get(page.contents.id)!;
                signals.push({
                  key: input.key,
                  type: input.type,
                  defaultPrevented: event.defaultPrevented,
                });
                signals.splice(0, Math.max(0, signals.length - 30));
              });
              page.contents.on('before-mouse-event', (event, input) => {
                const signals = inputSignals.get(page.contents.id)!;
                signals.push({ ...input, defaultPrevented: event.defaultPrevented });
                signals.splice(0, Math.max(0, signals.length - 30));
              });
            }
            if (
              initialized.has(page.contents.id) ||
              page.contents.isLoading() ||
              page.contents.getURL() !== 'about:blank'
            )
              continue;
            initialized.add(page.contents.id);
            await page.contents.executeJavaScript(
              `(() => { if(location.href !== 'about:blank') return; document.title='Native fixture'; document.body.innerHTML='<input id="name"><input id="password" type="password"><button id="go">Continue</button><p id="result">Ready</p><div id="scroller" style="height:80px;overflow:auto"><div style="height:900px">Long form</div></div>'; document.querySelector('#go').onclick=()=>document.querySelector('#result').textContent='Clicked by agent'; document.querySelector('#go').onmouseenter=()=>document.querySelector('#go').dataset.hovered='true'; })()`,
            );
          }
        const text = await readFile(process.env.PITCHCREW_NATIVE_SMOKE_COMMAND!, 'utf8').catch(
          () => '',
        );
        if (!text || text === last) return;
        let parsed: unknown;
        try {
          parsed = JSON.parse(text);
        } catch {
          return;
        }
        last = text;
        const command = parsed as {
          kind: string;
          id: string;
          otherId?: string;
          nonce: string;
          expression?: string;
          image?: string;
          contentsId?: number;
          operation?: string;
          before?: string;
          inputs?: (
            | Electron.KeyboardInputEvent
            | Electron.MouseInputEvent
            | Electron.MouseWheelInputEvent
          )[];
          bounds?: Electron.Rectangle;
        };
        commandNonce = command.nonce;
        commandKind = command.kind;
        commandId = command.id;
        const group = host.groups.get(command.id);
        if (command.kind === 'guest-lifecycle' && group) {
          const contents = group.pages.get(group.active)!.contents;
          const old = command.contentsId ? webContents.fromId(command.contentsId) : undefined;
          await writeFile(
            process.env.PITCHCREW_NATIVE_SMOKE_RESULT!,
            JSON.stringify({
              nonce: command.nonce,
              value: { contentsId: contents.id, oldAlive: !!old && !old.isDestroyed() },
            }),
          );
        }
        if (command.kind === 'input-shield' && group) {
          const bounds = group.bounds;
          const blocked = bounds
            ? await window.webContents.executeJavaScript(
                `!!document.elementFromPoint(${bounds.x + bounds.width / 2},${bounds.y + bounds.height / 2})?.dataset.browserInputGuard`,
              )
            : null;
          await writeFile(
            process.env.PITCHCREW_NATIVE_SMOKE_RESULT!,
            JSON.stringify({ nonce: command.nonce, value: blocked }),
          );
        }
        if (command.kind === 'frame-pixel' && group) {
          const contents = group.pages.get(group.active)!.contents;
          const point = await contents.executeJavaScript(
            `(()=>{const rect=document.querySelector('#capture-marker').getBoundingClientRect();return {x:rect.x+rect.width/2,y:rect.y+rect.height/2,width:innerWidth}})()`,
          );
          const image = nativeImage.createFromBuffer(Buffer.from(command.image!, 'base64'));
          const size = image.getSize();
          const scale = size.width / point.width;
          const offset =
            (Math.floor(point.y * scale) * size.width + Math.floor(point.x * scale)) * 4;
          const pixel = Array.from(image.toBitmap({ scaleFactor: 1 }).subarray(offset, offset + 4));
          await writeFile(
            process.env.PITCHCREW_NATIVE_SMOKE_RESULT!,
            JSON.stringify({ nonce: command.nonce, value: pixel }),
          );
        }
        if (command.kind === 'stream-state' && group) {
          const contents = group.pages.get(group.active)!.contents;
          const views = await window.webContents.executeJavaScript(
            'window.pitchcrewBrowser.views()',
          );
          const view = views.find(
            (view: { contentsId: number }) => view.contentsId === contents.id,
          );
          await writeFile(
            process.env.PITCHCREW_NATIVE_SMOKE_RESULT!,
            JSON.stringify({
              nonce: command.nonce,
              value: {
                frames: streamFrames.get(contents.id) ?? 0,
                painting: view?.painting ?? false,
              },
            }),
          );
        }
        if (command.kind === 'artifact' && group) {
          try {
            const value = await nativeArtifactFixture(window, group, command.operation!);
            await writeFile(
              process.env.PITCHCREW_NATIVE_SMOKE_RESULT!,
              JSON.stringify({ nonce: command.nonce, value }),
            );
          } catch (error) {
            await writeFile(
              process.env.PITCHCREW_NATIVE_SMOKE_RESULT!,
              JSON.stringify({ nonce: command.nonce, error: String(error) }),
            );
          }
        }
        if (command.kind === 'downloads' && group) {
          const contents = group.pages.get(group.active)!.contents;
          await writeFile(
            process.env.PITCHCREW_NATIVE_SMOKE_RESULT!,
            JSON.stringify({
              nonce: command.nonce,
              value: nativeFixtureDownloads(contents.session),
            }),
          );
        }
        if (command.kind === 'find' && group) {
          const contents = group.pages.get(group.active)!.contents;
          const result = new Promise<Electron.Result>((resolve, reject) => {
            const timer = setTimeout(() => {
              contents.removeListener('found-in-page', found);
              reject(new Error('Native Find did not report a final result.'));
            }, 5000);
            const found = (_event: Electron.Event, result: Electron.Result) => {
              if (!result.finalUpdate) return;
              clearTimeout(timer);
              contents.removeListener('found-in-page', found);
              resolve(result);
            };
            contents.on('found-in-page', found);
          });
          await window.webContents.executeJavaScript(
            `window.pitchcrewBrowser.find(${JSON.stringify(group.id)}, 'Fictional', true)`,
          );
          await writeFile(
            process.env.PITCHCREW_NATIVE_SMOKE_RESULT!,
            JSON.stringify({ nonce: command.nonce, value: await result }),
          );
        }
        if (command.kind === 'input-signals' && group) {
          const contents = group.pages.get(group.active)!.contents;
          await writeFile(
            process.env.PITCHCREW_NATIVE_SMOKE_RESULT!,
            JSON.stringify({ nonce: command.nonce, value: inputSignals.get(contents.id) ?? [] }),
          );
        }
        if (command.kind === 'fixture' && group) {
          if (command.bounds) host.mount(group.id, command.bounds);
          const contents = group.pages.get(group.active)!.contents;
          if (command.before) await contents.executeJavaScript(command.before);
          for (const input of command.inputs ?? []) contents.sendInputEvent(input);
          const value = command.expression
            ? await contents.executeJavaScript(command.expression)
            : null;
          await writeFile(
            process.env.PITCHCREW_NATIVE_SMOKE_RESULT!,
            JSON.stringify({ nonce: command.nonce, value }),
          );
        }
        if (command.kind === 'renderer-reload') {
          const old = [...host.groups.values()].flatMap((group) => [...group.owned]);
          const loaded = once(window.webContents, 'did-finish-load');
          window.webContents.reload();
          await loaded;
          await window.webContents.executeJavaScript(
            await readFile(fileURLToPath(new URL('./renderer.iife.js', import.meta.url)), 'utf8'),
          );
          await writeFile(
            process.env.PITCHCREW_NATIVE_SMOKE_RESULT!,
            JSON.stringify({
              nonce: command.nonce,
              value: {
                closed: old.every((contents) => contents.isDestroyed()),
                groups: host.groups.size,
                guests: await window.webContents.executeJavaScript(
                  "document.querySelectorAll('webview').length",
                ),
              },
            }),
          );
        }
        if (command.kind === 'crash' && group) {
          const contents = group.pages.get(group.active)!.contents;
          const crashed = once(contents, 'render-process-gone');
          contents.forcefullyCrashRenderer();
          await crashed;
          await writeFile(
            process.env.PITCHCREW_NATIVE_SMOKE_RESULT!,
            JSON.stringify({ nonce: command.nonce, value: true }),
          );
        }
        if (command.kind === 'narrow' || command.kind === 'wide') {
          window.setContentSize(
            command.kind === 'narrow' ? 860 : 1440,
            command.kind === 'narrow' ? 620 : 1000,
          );
          await writeFile(
            process.env.PITCHCREW_NATIVE_SMOKE_RESULT!,
            JSON.stringify({ nonce: command.nonce }),
          );
        }
        if (command.kind === 'presentation' && group && command.otherId) {
          const other = host.groups.get(command.otherId)!;
          await checkNativeBrowserPresentation(window, host, group, other);
          await writeFile(
            process.env.PITCHCREW_NATIVE_SMOKE_RESULT!,
            JSON.stringify({ nonce: command.nonce, liveOverlays: true }),
          );
        }
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
              guestCount: await window.webContents.executeJavaScript(
                `document.querySelectorAll('webview').length`,
              ),
              contentsId: contents.id,
              displayedContentsId: await window.webContents.executeJavaScript(
                `(() => { const view = Array.from(document.querySelectorAll('webview')).find(node => node.style.visibility === 'visible' && Number(node.style.zIndex) > 0); return view?.getWebContentsId(); })()`,
              ),
            }),
          );
        }
        if (command.kind === 'popup' && group) {
          const contents = group.pages.get(group.active)!.contents;
          const opener = await contents.executeJavaScript(
            `(() => { const child = window.open('about:blank', '', 'nodeIntegration=yes,contextIsolation=no,sandbox=no,webviewTag=yes,width=760,height=480'); return !!child && child.opener === window; })()`,
          );
          await writeFile(
            process.env.PITCHCREW_NATIVE_SMOKE_RESULT!,
            JSON.stringify({
              nonce: command.nonce,
              opener,
              windows: BrowserWindow.getAllWindows().length,
              owned: group.popupWindows.size === 1,
              isolated: await Promise.all(
                [...group.popupWindows.values()].map((popup) =>
                  popup.webContents.executeJavaScript(
                    `typeof require === 'undefined' && typeof window.pitchcrewBrowser === 'undefined'`,
                  ),
                ),
              ).then((values) => values.every(Boolean)),
              hidden:
                !shown &&
                !focused &&
                BrowserWindow.getAllWindows().every(
                  (item) => !item.isVisible() && !item.isFocused(),
                ),
              windowStates: BrowserWindow.getAllWindows().map((item) => ({
                id: item.id,
                visible: item.isVisible(),
                focused: item.isFocused(),
                parent: item.getParentWindow()?.id,
              })),
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
          if (host.groups.size) throw new Error('Native browser sessions remained after cleanup.');
          const destroyed = once(window.webContents, 'destroyed');
          window.destroy();
          await destroyed;
          if (BrowserWindow.getAllWindows().length || webContents.getAllWebContents().length)
            throw new Error('Native browser contents remained after fixture cleanup.');
          app.quit();
        }
      } catch (error) {
        if (commandNonce) {
          const current = host.groups.get(commandId);
          const active = current?.pages.get(current.active)?.contents;
          const context =
            active && !active.isDestroyed()
              ? { url: active.getURL(), title: active.getTitle(), loading: active.isLoading() }
              : undefined;
          await writeFile(
            process.env.PITCHCREW_NATIVE_SMOKE_RESULT!,
            JSON.stringify({
              nonce: commandNonce,
              error: `${commandKind}: ${String(error)}; context ${JSON.stringify(context)}`,
            }),
          );
        } else {
          console.error(error);
          app.exit(1);
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
