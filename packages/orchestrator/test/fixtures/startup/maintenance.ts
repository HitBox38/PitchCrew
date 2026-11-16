import type { RuntimeInstallation } from '@pitchcrew/adapters';
import type { RuntimeUpdateInfo } from '@pitchcrew/core';

export const startupRuntimes = ['codex', 'claude-code', 'opencode'] as const;
export const startupInstallation = (id: string): RuntimeInstallation => ({
  executable: `/fixture/${id}`,
  realPath: `/fixture/${id}`,
  identity: `fixture-${id}`,
  installer: 'npm',
  command: { file: '/fixture/node', args: ['fixture-installer.js'] },
  manualCommand: 'fixture manual update',
  detail: 'Fictional installation',
});
export const startupUpdates = (): RuntimeUpdateInfo[] =>
  startupRuntimes.map((id) => ({
    id,
    status: 'available',
    installedVersion: '1.0.0',
    latestVersion: '1.1.0',
    checkedAt: '2026-11-01T00:00:00.000Z',
    lastSuccessAt: '2026-11-01T00:00:00.000Z',
    detail: 'Fictional update',
    installer: 'npm',
    canUpdate: true,
    manualCommand: 'fixture manual update',
  }));
