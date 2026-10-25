import type { HttpOperation } from '@pitchcrew/core/operational-logs';

/** Match registered route templates only; request URLs, parameters and bodies stay local. */
export const httpFailureOperation = (
  method: string,
  route: string | undefined,
): HttpOperation | undefined => {
  if (method !== 'POST') return undefined;
  switch (route) {
    case '/api/cards/:id/approval':
      return 'packet_export_requested';
    case '/api/approvals/:id/export':
      return 'packet_exported';
    case '/api/cards/:id/run':
      return 'workflow_started';
    default:
      return undefined;
  }
};
