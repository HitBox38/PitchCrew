import type { Snapshot } from '@pitchcrew/core';
import type { capabilityDefaults } from '../../agent-capabilities.ts';

type Capabilities = typeof capabilityDefaults;
type Tool = keyof Capabilities;

const services = {
  github: 'GitHub',
  gmail: 'Gmail',
  drive: 'Drive',
  calendar: 'Calendar',
  sheets: 'Sheets',
} as const;
const names: Partial<Record<Tool, string>> = {
  ...services,
  computerUse: 'browser access',
  readApplications: 'application reads',
  reviewPipeline: 'pipeline review',
};

const connected = (service: keyof typeof services, data: Pick<Snapshot, 'connectors'>) =>
  data.connectors.some((account) => account.connected && account.services.includes(service));

/**
 * Why a granted tool cannot work yet: a switched-off prerequisite or a missing account. Selecting
 * a tool never connects an account, so the reason stays visible until the user fixes it.
 */
export const toolBlocker = (
  tool: Tool,
  capabilities: Capabilities,
  data: Pick<Snapshot, 'connectors'>,
): string | undefined => {
  if (!capabilities[tool]) return undefined;
  if (tool in services) {
    const service = tool as keyof typeof services;
    return connected(service, data)
      ? undefined
      : `Connect ${service === 'github' ? 'GitHub' : 'Google'} in Settings to use ${services[service]}.`;
  }
  const needs: Partial<Record<Tool, Tool[]>> = {
    manageCareerPlans: ['readApplications'],
    trackApplications: ['gmail'],
    proposeCrewChanges: ['reviewPipeline'],
    assessForms: ['computerUse'],
    recordSubmissions: ['computerUse'],
  };
  if (tool === 'maintainProfile')
    return capabilities.github || capabilities.drive
      ? undefined
      : 'Needs GitHub or Drive access, and a watched source in Profile.';
  const missing = (needs[tool] ?? []).filter((required) => !capabilities[required]);
  return missing.length
    ? `Needs ${missing.map((key) => names[key] ?? key).join(' and ')}.`
    : undefined;
};

/** "2 of 4 on" for a tool group's disclosure. */
export const groupSummary = (keys: readonly Tool[], capabilities: Capabilities) =>
  `${keys.filter((key) => capabilities[key]).length} of ${keys.length} on`;
