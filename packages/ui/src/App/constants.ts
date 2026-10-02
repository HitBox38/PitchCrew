import { lazy } from 'react';

export const AddOpportunity = lazy(() =>
  import('@/components/AddOpportunity/index.tsx').then((m) => ({ default: m.AddOpportunity })),
);

export const CardDetails = lazy(() =>
  import('@/components/CardDetails/index.tsx').then((m) => ({ default: m.CardDetails })),
);

export const RoleSettings = lazy(() =>
  import('@/components/RoleSettings/index.tsx').then((m) => ({ default: m.RoleSettings })),
);

export const CommandPalette = lazy(() =>
  import('@/CommandPalette/index.tsx').then((m) => ({ default: m.CommandPalette })),
);
