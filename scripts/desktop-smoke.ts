import { defaultRoleIds } from '../packages/core/src/states.ts';
import { spawn, type ChildProcess } from 'node:child_process';
import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { electronExecutable } from './electron-path.ts';
import { waitForSmokeExit } from './desktop-smoke-exit.ts';
import { smokeStreamAckFile } from '../packages/desktop/src/smoke-stream.ts';

const directory = await mkdtemp(join(tmpdir(), 'pitchcrew-electron-check-'));
const evidence = join(directory, 'result.json');
const port = process.env.PITCHCREW_SMOKE_PORT ?? '14420';
const url = process.env.PITCHCREW_URL ?? `http://127.0.0.1:${port}`;
let daemon: ChildProcess | undefined;
let desktop: ChildProcess | undefined;

try {
  if (!process.env.PITCHCREW_URL) {
    daemon = spawn(process.execPath, ['--import', 'tsx', 'scripts/desktop-smoke-daemon.ts'], {
      env: {
        ...process.env,
        PITCHCREW_POSTHOG_DISABLED: '1',
        PITCHCREW_HOME: join(directory, 'workspace'),
        PITCHCREW_PORT: port,
        PITCHCREW_SEED_SKILLS: '0',
        PITCHCREW_UPDATE_CHECKS: '0',
        PITCHCREW_SMOKE_STREAM_ACK: smokeStreamAckFile(evidence),
      },
      stdio: 'inherit',
      windowsHide: true,
    });
    let ready = false;
    for (let i = 0; i < 60; i++) {
      try {
        const response = await fetch(`${url}/api/health`, { signal: AbortSignal.timeout(500) });
        if ((await response.json()).app === 'pitchcrew') {
          ready = true;
          break;
        }
      } catch {
        /* The daemon is still starting. */
      }
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
    if (!ready) throw new Error('The smoke-test daemon did not start.');
  }
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    PITCHCREW_POSTHOG_DISABLED: '1',
    PITCHCREW_URL: url,
    PITCHCREW_SMOKE_FILE: evidence,
    PITCHCREW_SMOKE_CHAT: process.env.PITCHCREW_URL ? '0' : '1',
  };
  delete env.ELECTRON_RUN_AS_NODE;
  desktop = spawn(electronExecutable, [resolve('packages/desktop/dist/main.mjs')], {
    env,
    stdio: 'inherit',
    windowsHide: true,
  });
  // The fixture includes delayed toast checks and a 201-card stale-cleanup regression.
  // Keep it bounded while allowing slower native CI runners to finish those actions.
  const exit = await waitForSmokeExit(desktop, evidence);
  const result = JSON.parse(await readFile(evidence, 'utf8'));
  if (process.env.PITCHCREW_SMOKE_VISIBLE !== '1' && !result.windowStayedHidden)
    throw new Error('Electron smoke check showed or focused its window.');
  if (
    result.apiStatus !== 200 ||
    result.requireType !== 'undefined' ||
    result.roles !== defaultRoleIds.length ||
    !result.iconLoaded ||
    !result.uiReady ||
    !result.styleChecks ||
    !Object.values(result.styleChecks).every(Boolean) ||
    !result.sheetChecks ||
    !Object.values(result.sheetChecks).every(Boolean) ||
    !result.notificationsInAppOnly ||
    (!process.env.PITCHCREW_URL &&
      (!result.onboardingReady ||
        !result.retainedRuntimeReady ||
        !result.appUpdatesReady ||
        !result.runtimeUpdatesReady ||
        !result.insightsReady ||
        !result.chatReady ||
        !result.conversationNavigationReady ||
        !result.chatResponded ||
        !result.chatTabsReady ||
        !result.chatAttachmentsReady ||
        !result.userQuestionsReady ||
        result.chatStreamingUpdates < 2 ||
        !result.routerHistoryReady ||
        !result.featurePanelsReady ||
        !result.notificationPanelReady ||
        !result.notificationToastReady))
  )
    throw new Error('Electron renderer/daemon check failed.');
  if (
    !result.themeSourceRestored ||
    result.chrome?.length !== 2 ||
    !result.chrome.every(
      (chrome: {
        platform: string;
        height: number;
        sidebarTop: number;
        dragRegion: string;
        overflow: boolean;
        nativeTheme: string;
        theme: string;
        background: string;
      }) =>
        chrome.platform === process.platform &&
        chrome.height === 40 &&
        chrome.sidebarTop === 40 &&
        chrome.dragRegion === 'drag' &&
        !chrome.overflow &&
        chrome.nativeTheme === chrome.theme &&
        chrome.background === (chrome.theme === 'dark' ? 'rgb(26, 27, 30)' : 'rgb(242, 241, 236)'),
    )
  )
    throw new Error('Electron title bar theme/layout check failed.');
  console.log(
    JSON.stringify(
      { check: 'passed', ...result, ...exit, evidence, screenshot: `${evidence}.png` },
      null,
      2,
    ),
  );
} finally {
  desktop?.kill();
  daemon?.kill();
}
