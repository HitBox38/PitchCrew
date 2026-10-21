import type { ConnectorStatus, Role } from '@pitchcrew/core';

const googleServices = ['gmail', 'drive', 'calendar', 'sheets'] as const;
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
