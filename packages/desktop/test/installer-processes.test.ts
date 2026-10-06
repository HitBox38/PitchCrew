import { test, expect } from 'vitest';
import { execFile, spawn, type ChildProcess } from 'node:child_process';
import { copyFile, link, mkdir, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';

const windowsTest = test.skipIf(process.platform !== 'win32');
const script = fileURLToPath(new URL('../installer/processes.ps1', import.meta.url));
const powershell = join(
  process.env.SystemRoot ?? 'C:\\Windows',
  'System32/WindowsPowerShell/v1.0/powershell.exe',
);
const execute = promisify(execFile);
const options = { windowsHide: true, timeout: 30000 };
const flags = ['-NoLogo', '-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass'];

async function removeFixture(directory: string) {
  if (
    dirname(directory) !== resolve(tmpdir()) ||
    !basename(directory).startsWith('pitchcrew-installer-processes-')
  )
    throw new Error('Unsafe installer fixture cleanup path.');
  await rm(directory, { recursive: true, force: true });
}

windowsTest(
  'process selection excludes installers, unrelated binaries, sibling folders and the calling installer',
  async () => {
    const root = "C:\\Apps\\Tomer's Pitchcrew";
    const paths = [
      `${root}\\Pitchcrew.exe`,
      `${root}\\resources\\runtime\\node\\node.exe`,
      `${root}\\resources\\runtime\\browsers\\chromium-123\\chrome-win64\\chrome.exe`,
      `${root}-downloads\\Pitchcrew.exe`,
      `${root}\\Pitchcrew-0.1.0-win-x64.exe`,
      `${root}\\Uninstall Pitchcrew.exe`,
      `${root}\\other.exe`,
      `${root}\\resources\\runtime\\browsers-backup\\chrome.exe`,
      `${root}\\resources\\runtime\\browsers\\other.exe`,
      `${root}\\Pitchcrew.exe`,
      null,
      'C:\\Previous\\Pitchcrew.exe',
    ];
    const { stdout } = await execute(
      powershell,
      [
        ...flags,
        '-Command',
        `. $env:PITCHCREW_TEST_SCRIPT; $cases = $env:PITCHCREW_TEST_PROCESSES | ConvertFrom-Json; @(Select-PitchcrewProcesses $cases @($env:PITCHCREW_TEST_ROOT, 'C:\\Previous') 'Pitchcrew.exe' 10) | ForEach-Object { $_.ProcessId } | ConvertTo-Json -Compress`,
      ],
      {
        ...options,
        env: {
          ...process.env,
          PITCHCREW_TEST_SCRIPT: script,
          PITCHCREW_TEST_ROOT: `${root.toUpperCase()}\\`,
          PITCHCREW_TEST_PROCESSES: JSON.stringify(
            paths.map((ExecutablePath, i) => ({ ExecutablePath, ProcessId: i + 1 })),
          ),
        },
      },
    );
    expect(JSON.parse(stdout)).toEqual([1, 2, 3, 12]);
  },
);

windowsTest(
  'checks and closes real app processes while preserving the installer and sibling processes',
  async () => {
    const directory = await mkdtemp(join(tmpdir(), 'pitchcrew-installer-processes-'));
    const root = join(directory, "Tomer's אפליקציה");
    const children: ChildProcess[] = [];
    const launch = async (path: string) => {
      await mkdir(dirname(path), { recursive: true });
      await link(process.execPath, path).catch(() => copyFile(process.execPath, path));
      const child = spawn(path, ['-e', 'setInterval(() => {}, 1000)'], {
        windowsHide: true,
        stdio: 'ignore',
      });
      children.push(child);
      await new Promise<void>((resolve, reject) => {
        child.once('spawn', resolve);
        child.once('error', reject);
      });
      return child;
    };
    const command = async (mode: string) => {
      try {
        await execute(
          powershell,
          [
            ...flags,
            '-File',
            script,
            '-InstallDirectory',
            root,
            '-AppExecutable',
            'Pitchcrew.exe',
            '-InstallerProcessId',
            String(process.pid),
            '-Mode',
            mode,
          ],
          options,
        );
        return 0;
      } catch (error) {
        if ((error as { code: number }).code === 10) return 10;
        throw error;
      }
    };
    try {
      const installer = await launch(join(root, 'Pitchcrew-0.1.0-win-x64.exe'));
      const sibling = await launch(join(`${root}-downloads`, 'Pitchcrew.exe'));
      expect(await command('check')).toBe(0);
      const app = await launch(join(root, 'Pitchcrew.exe'));
      const runtime = await launch(join(root, 'resources/runtime/node/node.exe'));
      expect(await command('check')).toBe(10);
      expect(await command('close')).toBe(0);
      expect(await command('check')).toBe(0);
      expect(app.exitCode !== null || app.signalCode !== null).toBe(true);
      expect(runtime.exitCode !== null || runtime.signalCode !== null).toBe(true);
      for (const child of [installer, sibling]) {
        expect(child.exitCode).toBe(null);
        expect(child.signalCode).toBe(null);
      }
    } finally {
      await Promise.all(
        children.map(async (child) => {
          if (child.exitCode !== null || child.signalCode !== null) return;
          const exited = new Promise((resolve) => child.once('exit', resolve));
          child.kill();
          await exited;
        }),
      );
      await removeFixture(directory);
    }
  },
  60000,
);
