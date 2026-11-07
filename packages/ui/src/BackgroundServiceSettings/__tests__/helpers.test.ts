import type { BackgroundServiceInfo } from '@pitchcrew/core';
import { expect, it } from 'vitest';
import {
  serviceBadges,
  serviceCommands,
  serviceDiagnostics,
  serviceNotes,
  serviceRunning,
} from '../helpers.ts';

const info = (overrides: Partial<BackgroundServiceInfo> = {}): BackgroundServiceInfo => ({
  status: {
    platform: 'windows',
    installed: true,
    enabled: true,
    running: true,
    pid: 4242,
    directory: 'C:\\Users\\Fixture\\.pitchcrew',
    port: 4417,
    definition: 'Task Scheduler task "Pitchcrew"',
    logFile: 'C:\\Users\\Fixture\\.pitchcrew\\background-service\\daemon.log',
    detail: 'Task Scheduler has the task.',
  },
  startedByService: true,
  matches: true,
  customLocation: false,
  repository: 'C:\\Projects\\Pitch Crew',
  commands: {
    install: 'bun run service install',
    uninstall: 'bun run service uninstall',
    status: 'bun run service status',
    logs: 'bun run service logs',
  },
  ...overrides,
});

it('shows an installed service that started this daemon with removal commands', () => {
  const value = info();
  expect(serviceBadges(value)).toEqual([
    { label: 'Installed', success: true },
    { label: 'Running', success: true },
  ]);
  expect(serviceNotes(value)).toEqual([
    'This workspace’s background service keeps routines running after you close the window.',
  ]);
  expect(serviceCommands(value)).toEqual([
    'bun run service status',
    'bun run service logs',
    'bun run service uninstall',
  ]);
});

it('offers install for a missing service and explains a service for another folder', () => {
  const missing = info({
    startedByService: false,
    matches: false,
    customLocation: true,
    status: { ...info().status, installed: false, enabled: false, running: false, pid: null },
  });
  expect(serviceBadges(missing)).toEqual([{ label: 'Not installed', success: false }]);
  expect(serviceCommands(missing)).toEqual([]);
  expect(serviceNotes(missing)).toHaveLength(1);
  expect(serviceNotes(missing)[0]).toContain('Install the service');
  expect(serviceDiagnostics(missing).join(' ')).toContain('data folder and port automatically');
  const elsewhere = info({ matches: false, startedByService: false });
  expect(serviceBadges(elsewhere)[0]).toEqual({
    label: 'Installed for another workspace',
    success: false,
  });
  expect(serviceNotes(elsewhere)).toHaveLength(1);
  expect(serviceNotes(elsewhere)[0]).toContain('running for another workspace');
  expect(serviceDiagnostics(elsewhere).join(' ')).toContain('on port 4417');
  expect(serviceBadges(elsewhere)[1]).toEqual({ label: 'Running elsewhere', success: false });
  expect(serviceCommands(elsewhere)).toEqual(['bun run service uninstall']);
});

it('explains unsupported platforms without commands', () => {
  const unsupported = info({
    status: { ...info().status, platform: null, installed: false, detail: 'Unsupported fixture.' },
  });
  expect(serviceBadges(unsupported)).toEqual([{ label: 'Unavailable', success: false }]);
  expect(serviceNotes(unsupported)).toEqual(['Unsupported fixture.']);
  expect(serviceCommands(unsupported)).toEqual([]);
});

it('shows a running bead only for this workspace’s running service', () => {
  expect(serviceRunning(info())).toBe(true);
  expect(serviceRunning(info({ matches: false }))).toBe(false);
  expect(serviceRunning(info({ status: { ...info().status, running: false } }))).toBe(false);
});

it('keeps the service explanation scoped to the current workspace without dumping diagnostics', () => {
  const elsewhere = info({ matches: false, startedByService: false });
  expect(serviceNotes(elsewhere)[0]).not.toContain('4417');
  expect(serviceNotes(elsewhere)[0]).not.toContain('Task Scheduler');
  expect(serviceDiagnostics(elsewhere)).toContain('Task Scheduler has the task.');
  const ownManual = info({ startedByService: false });
  expect(serviceNotes(ownManual)).toEqual([
    'The service will start this workspace at login; the current workspace was opened separately.',
  ]);
  expect(
    serviceNotes(
      info({
        matches: false,
        startedByService: false,
        status: { ...info().status, running: false },
      }),
    )[0],
  ).toContain('set up for another workspace');
});
