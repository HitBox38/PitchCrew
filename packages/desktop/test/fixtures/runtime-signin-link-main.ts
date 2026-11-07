import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { writeFile } from 'node:fs/promises';
import { appendFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';
import { app, BrowserWindow, dialog, ipcMain, session, shell } from 'electron';
import { installExternalNavigation } from '../../src/external-navigation.ts';

const home = process.env.PITCHCREW_SIGNIN_LINK_HOME!;
const resultFile = process.env.PITCHCREW_SIGNIN_LINK_RESULT!;
const target = 'https://auth.openai.com/authorize?fixture=1';
const stage = (value: string) => appendFileSync(`${resultFile}.stages`, `${value}\n`);
stage('entry');
app.setPath('userData', home);
if (process.platform === 'darwin') app.setActivationPolicy('accessory');
app.commandLine.appendSwitch('disable-gpu');
app.on('window-all-closed', () => {});

const external: string[] = [],
  feedback: unknown[] = [];
let dialogs = 0,
  created = 0,
  shown = false,
  focused = false,
  networkBlocked = 0;
// These are the only intercepted production boundaries: never open an OS browser/dialog.
shell.openExternal = async (url) => {
  external.push(url);
};
dialog.showMessageBox = async () => {
  dialogs++;
  return { response: 0, checkboxChecked: false };
};
app.on('browser-window-created', (_event, window) => {
  created++;
  window.on('show', () => {
    shown = true;
  });
  window.on('focus', () => {
    focused = true;
  });
});
ipcMain.on('pitchcrew:signin-link-test-feedback', (_event, reason: unknown) =>
  feedback.push(reason),
);

const server = createServer((_request, response) => {
  response.writeHead(200, {
    'content-type': 'text/html',
    'content-security-policy': "default-src 'none'",
  });
  response.end('<!doctype html><meta charset="utf-8"><title>Isolated sign-in link fixture</title>');
});
let window: BrowserWindow | undefined;
const until = async (condition: () => boolean) => {
  const deadline = performance.now() + 3000;
  while (!condition()) {
    if (performance.now() >= deadline) throw new Error('Native link dispatch timed out.');
    await delay(10);
  }
};
void app.whenReady().then(async () => {
  try {
    stage('ready');
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const address = server.address();
    assert(address && typeof address !== 'string');
    const origin = `http://127.0.0.1:${address.port}`;
    session.defaultSession.webRequest.onBeforeRequest((request, done) => {
      const allowed = request.url.startsWith(`${origin}/`);
      if (!allowed) networkBlocked++;
      done({ cancel: !allowed });
    });
    window = new BrowserWindow({
      show: false,
      focusable: false,
      skipTaskbar: true,
      width: 640,
      height: 480,
      webPreferences: {
        preload: fileURLToPath(new URL('./preload.cjs', import.meta.url)),
        sandbox: true,
        contextIsolation: true,
        nodeIntegration: false,
        backgroundThrottling: false,
      },
    });
    installExternalNavigation(window, origin);
    await window.loadURL(`${origin}/settings`);
    stage('loaded');
    const activation = await window.webContents.executeJavaScript(
      `(async () => {
    await new Promise(resolve => setTimeout(resolve, 150));
    const active = navigator.userActivation.isActive;
    window.open(${JSON.stringify(target)}, '_blank', 'noopener,noreferrer');
    return active;
  })()`,
      false,
    );
    await until(() => external.length === 1);
    stage('async-link-dispatched');
    assert.equal(activation, false, 'The test must run without active user activation.');
    assert.deepEqual(external, [target]);
    assert.deepEqual(
      feedback,
      [],
      'A validated asynchronous link must not produce a blocked-link toast.',
    );
    assert.equal(dialogs, 0);
    assert.equal(created, 1, 'No Electron popup may be created.');
    assert.equal(BrowserWindow.getAllWindows().length, 1);
    await window.webContents.executeJavaScript("window.open('', '_blank')", false);
    await until(() => feedback.length === 1);
    stage('empty-link-blocked');
    assert.deepEqual(feedback, ['unsupported-protocol'], 'The old empty placeholder is blocked.');
    assert.deepEqual(external, [target], 'An empty placeholder must not reach the OS.');
    assert.equal(created, 1);
    assert.equal(window.isVisible(), false);
    assert.equal(window.isFocused(), false);
    assert.equal(shown, false);
    assert.equal(focused, false);
    assert.equal(networkBlocked, 0, 'No external navigation request was started.');
    await writeFile(
      resultFile,
      JSON.stringify(
        {
          passed: true,
          electron: process.versions.electron,
          node: process.versions.node,
          rendererUserActivation: activation,
          externalOpeningIntercepted: true,
          asyncHttpsDispatches: external.length,
          validatedUrl: target,
          validLinkFeedback: [],
          emptyPlaceholderFeedback: feedback,
          browserWindowsCreated: created,
          windowStayedHidden: !shown && !window.isVisible(),
          windowStayedUnfocused: !focused && !window.isFocused(),
          dialogs,
          externalNetworkRequests: networkBlocked,
        },
        null,
        2,
      ),
    );
    window.destroy();
    window = undefined;
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
    app.quit();
  } catch (error) {
    console.error(error);
    window?.destroy();
    server.close();
    app.exit(1);
  }
});
