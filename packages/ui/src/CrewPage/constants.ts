import { lazy } from 'react';

export const ConnectorSettings = lazy(() =>
  import('@/ConnectorSettings/index.tsx').then((m) => ({ default: m.ConnectorSettings })),
);
