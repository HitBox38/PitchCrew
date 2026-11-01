import type { ConnectorStatus, Role } from '@pitchcrew/core';

const googleServices = ['gmail', 'drive', 'sheets', 'calendar'] as const;
export const connectorAgents = (roles: Role[], connector: ConnectorStatus) => {
  const services = new Set(connector.services);
  return roles
    .filter((role) => !role.retiredAt)
    .map((role) => ({
      role,
      enabled:
        connector.id === 'github'
          ? !!role.capabilities?.github
          : googleServices.some((service) => services.has(service) && role.capabilities?.[service]),
    }));
};

export const accountPresentation = (connector: ConnectorStatus) => {
  const name = connector.id === 'github' ? 'GitHub' : 'Google Workspace';
  const state = connector.connected
    ? 'Connected'
    : connector.pending
      ? 'Signing in…'
      : 'Not connected';
  let description =
    connector.id === 'github'
      ? 'Research repositories, files, profiles and issues.'
      : 'Read Gmail, Drive, Docs, Sheets and Calendar.';
  if (connector.connected) description = connector.account ?? '';
  else if (connector.pending) description = 'Complete sign-in to connect this account.';
  return { name, state, description };
};

const serviceLabels = {
  github: 'Repositories, files and issues',
  gmail: 'Gmail',
  drive: 'Drive and Docs',
  sheets: 'Sheets',
  calendar: 'Calendar',
} as const;

/**
 * Effective access per read-only service: whether the account grants it, and which agents have
 * the matching capability. A capability without a granted service gives no access.
 */
export const serviceAccess = (roles: Role[], connector: ConnectorStatus) => {
  const services = connector.id === 'github' ? (['github'] as const) : googleServices;
  return services.map((service) => {
    const granted =
      connector.connected && (service === 'github' || connector.services.includes(service));
    const agents = roles
      .filter((role) => !role.retiredAt && role.capabilities?.[service])
      .map((role) => role.name);
    const note = granted
      ? agents.length
        ? agents.join(', ')
        : 'No agents'
      : !connector.connected
        ? `Connect ${connector.id === 'github' ? 'GitHub' : 'Google'} first`
        : 'Not granted by this Google account';
    return { service, label: serviceLabels[service], granted, agents, note };
  });
};
