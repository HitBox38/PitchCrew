import type { ConnectorStatus, Role } from '@pitchcrew/core';

const googleServices = ['gmail', 'drive', 'calendar', 'sheets'] as const;
export const connectorAgents = (roles: Role[], connector: ConnectorStatus) =>
  roles
    .filter((role) => !role.retiredAt)
    .map((role) => ({
      role,
      enabled:
        connector.id === 'github'
          ? !!role.capabilities?.github
          : googleServices.some(
              (service) => connector.services.includes(service) && role.capabilities?.[service],
            ),
    }));
