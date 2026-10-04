import type { BackgroundServiceInfo } from '@pitchcrew/core';
import { expect, it } from 'vitest';
import { serviceBadges, serviceCommands, serviceNotes } from '../helpers.ts';

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
    install: 'pnpm service install',
    uninstall: 'pnpm service uninstall',
    status: 'pnpm service status',
    logs: 'pnpm service logs',
  },
  ...overrides,
});

it('shows an installed service that started this daemon with removal commands', () => {
  const value = info();
  expect(serviceBadges(value)).toEqual([
    { label: 'Installed', success: true },
    { label: 'Running', success: true },
  ]);
  expect(serviceNotes(value)[0]).toContain('The background service started this daemon');
  expect(serviceCommands(value)).toEqual([
    'pnpm service status',
    'pnpm service logs',
    'pnpm service uninstall',
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
  expect(serviceCommands(missing)).toEqual(['pnpm service install', 'pnpm service status']);
  expect(serviceNotes(missing).join(' ')).toContain('PITCHCREW_HOME and PITCHCREW_PORT');
  const elsewhere = info({ matches: false, startedByService: false });
  expect(serviceBadges(elsewhere)[0]).toEqual({
    label: 'Installed for another folder',
    success: false,
  });
  expect(serviceNotes(elsewhere).join(' ')).toContain('on port 4417');
  expect(serviceCommands(elsewhere)).toEqual(['pnpm service install', 'pnpm service uninstall']);
});

it('explains unsupported platforms without commands', () => {
  const unsupported = info({
    status: { ...info().status, platform: null, installed: false, detail: 'Unsupported fixture.' },
  });
  expect(serviceBadges(unsupported)).toEqual([{ label: 'Unavailable', success: false }]);
  expect(serviceNotes(unsupported)).toEqual(['Unsupported fixture.']);
  expect(serviceCommands(unsupported)).toEqual([]);
});
