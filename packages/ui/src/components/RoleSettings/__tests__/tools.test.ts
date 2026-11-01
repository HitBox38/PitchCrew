import { describe, expect, it } from 'vitest';
import type { Snapshot } from '@pitchcrew/core';
import { capabilityDefaults } from '../../../agent-capabilities.ts';
import { groupSummary, toolBlocker } from '../tools.ts';

const none = { connectors: [] } as unknown as Snapshot;
const google = {
  connectors: [{ connected: true, services: ['gmail', 'drive'] }],
} as unknown as Snapshot;

describe('agent tool blockers', () => {
  it('stays quiet for tools that are off or ready', () => {
    expect(toolBlocker('gmail', capabilityDefaults, none)).toBeUndefined();
    expect(toolBlocker('gmail', { ...capabilityDefaults, gmail: true }, google)).toBeUndefined();
    expect(toolBlocker('messageAgents', capabilityDefaults, none)).toBeUndefined();
  });
  it('names the missing account without connecting it', () => {
    expect(toolBlocker('gmail', { ...capabilityDefaults, gmail: true }, none)).toBe(
      'Connect Google in Settings to use Gmail.',
    );
    expect(toolBlocker('github', { ...capabilityDefaults, github: true }, google)).toBe(
      'Connect GitHub in Settings to use GitHub.',
    );
  });
  it('names switched-off prerequisites', () => {
    expect(toolBlocker('assessForms', { ...capabilityDefaults, assessForms: true }, none)).toBe(
      'Needs browser access.',
    );
    expect(
      toolBlocker('trackApplications', { ...capabilityDefaults, trackApplications: true }, none),
    ).toBe('Needs Gmail.');
    expect(
      toolBlocker(
        'maintainProfile',
        { ...capabilityDefaults, maintainProfile: true, drive: true },
        none,
      ),
    ).toBeUndefined();
  });
  it('summarises a group by how many tools are on', () => {
    expect(groupSummary(['gmail', 'drive', 'github'], { ...capabilityDefaults, gmail: true })).toBe(
      '1 of 3 on',
    );
  });
});
