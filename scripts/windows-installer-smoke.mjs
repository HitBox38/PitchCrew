import assert from 'node:assert/strict';
import { execFile, spawn } from 'node:child_process';
import { copyFile, link, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { promisify } from 'node:util';

if (process.platform !== 'win32') throw new Error('This installer check requires Windows.');
const require = createRequire(import.meta.url);
const builderRequire = createRequire(require.resolve('electron-builder'));
// Reuse the exact pinned compiler already acquired by desktop:package.
const { getMakeNsisPath } = builderRequire('app-builder-lib/out/toolsets/windows.js');
const compiler = await getMakeNsisPath();
const execute = promisify(execFile);
const directory = await mkdtemp(join(tmpdir(), 'pitchcrew-nsis-check-'));
const root = join(directory, "Tomer's אפליקציה");
const installer = join(root, 'Pitchcrew-0.1.0-win-x64.exe');
const source = join(directory, 'check.nsi');
const result = join(directory, 'result.txt');
const children = [];
const env = {
  ...process.env,
  ...compiler.env,
  PITCHCREW_TEST_INSTALL_DIRECTORY: `${root}\\`,
  PITCHCREW_TEST_RESULT: result,
};
async function launch(path) {
  await mkdir(dirname(path), { recursive: true });
  await link(process.execPath, path).catch(() => copyFile(process.execPath, path));
  const child = spawn(path, ['-e', 'setInterval(() => {}, 1000)'], {
    windowsHide: true,
    stdio: 'ignore',
  });
  children.push(child);
  await new Promise((resolve, reject) => {
    child.once('spawn', resolve);
    child.once('error', reject);
  });
  return child;
}
async function check(path = installer) {
  await rm(result, { force: true });
  try {
    await execute(path, ['/S'], { env, windowsHide: true, timeout: 60000 });
  } catch (error) {
    throw new Error(
      `NSIS process check exited ${error.code}: ${await readFile(result, 'utf8').catch(() => 'No result written.')}`,
    );
  }
  assert.equal(await readFile(result, 'utf8'), 'passed');
}
async function cleanup() {
  await Promise.all(
    children.map(async (child) => {
      if (child.exitCode !== null || child.signalCode !== null) return;
      const exited = new Promise((resolve) => child.once('exit', resolve));
      child.kill();
      await exited;
    }),
  );
  if (
    dirname(directory) !== resolve(tmpdir()) ||
    !basename(directory).startsWith('pitchcrew-nsis-check-')
  )
    throw new Error('Unsafe NSIS fixture cleanup path.');
  await rm(directory, { recursive: true, force: true });
}
try {
  await mkdir(root, { recursive: true });
  // Exercise the production macro without installing files, writing registry keys or changing shortcuts.
  await writeFile(
    source,
    `
Unicode true
!include LogicLib.nsh
!define APP_EXECUTABLE_FILENAME "Pitchcrew.exe"
!define INSTALL_REGISTRY_KEY "Software\\PitchcrewInstallerSmokeFixture"
!define isUpdated "1 == 0"
!include "${resolve('packages/desktop/installer/installer.nsh')}"
Name "Pitchcrew installer check"
OutFile "${installer}"
RequestExecutionLevel user
SilentInstall silent
LangString appRunning 1033 "Close Pitchcrew to continue."
LangString appClosing 1033 "Closing Pitchcrew."
LangString appCannotBeClosed 1033 "Pitchcrew cannot be closed."
Function .onInit
  ReadEnvStr $INSTDIR PITCHCREW_TEST_INSTALL_DIRECTORY
FunctionEnd
Section
  !insertmacro customCheckAppRunning
  ReadEnvStr $R0 PITCHCREW_TEST_RESULT
  FileOpen $R1 $R0 w
  FileWrite $R1 "passed"
  FileClose $R1
  SetErrorLevel 0
SectionEnd
`,
    'utf8',
  );
  await execute(compiler.path, ['-V2', '-INPUTCHARSET', 'UTF8', source], {
    env,
    windowsHide: true,
    timeout: 30000,
  });
  const sibling = await launch(join(`${root}-downloads`, 'Pitchcrew.exe'));
  await check();
  const app = await launch(join(root, 'Pitchcrew.exe'));
  const runtime = await launch(join(root, 'resources/runtime/node/node.exe'));
  await check();
  assert.ok(app.exitCode !== null || app.signalCode !== null);
  assert.ok(runtime.exitCode !== null || runtime.signalCode !== null);
  assert.equal(sibling.exitCode, null);
  assert.equal(sibling.signalCode, null);
  await copyFile(installer, join(root, 'Pitchcrew.exe'));
  await check(join(root, 'Pitchcrew.exe'));
  console.log(
    'Windows installer check passed: downloads and siblings ignored, owned processes closed, installer PID excluded.',
  );
} finally {
  await cleanup();
}
