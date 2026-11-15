import { lazy } from 'react';

export const WritingSettings = lazy(() =>
  import('@/WritingSettings/index.tsx').then((m) => ({ default: m.WritingSettings })),
);
export const BackgroundServiceSettings = lazy(() =>
  import('@/BackgroundServiceSettings/index.tsx').then((m) => ({
    default: m.BackgroundServiceSettings,
  })),
);
export const AnalyticsSettings = lazy(() =>
  import('@/Analytics/components/AnalyticsSettings.tsx').then((m) => ({
    default: m.AnalyticsSettings,
  })),
);
export const ConnectorSettings = lazy(() =>
  import('@/ConnectorSettings/index.tsx').then((m) => ({ default: m.ConnectorSettings })),
);
export const ExternalMcpSettings = lazy(() =>
  import('@/ExternalMcpSettings/index.tsx').then((m) => ({ default: m.ExternalMcpSettings })),
);
export const RemoteMcpSettings = lazy(() =>
  import('@/RemoteMcpSettings/index.tsx').then((m) => ({ default: m.RemoteMcpSettings })),
);
export const JobSourcesSettings = lazy(() =>
  import('@/JobSourcesSettings/index.tsx').then((m) => ({ default: m.JobSourcesSettings })),
);
export const PacketRulesSettings = lazy(() =>
  import('@/PacketRules/index.tsx').then((m) => ({ default: m.PacketRulesSettings })),
);
export const RuntimeSettings = lazy(() =>
  import('./components/RuntimeSettings.tsx').then((m) => ({ default: m.RuntimeSettings })),
);
export const UpdatesSettings = lazy(() =>
  import('./components/UpdatesSettings.tsx').then((m) => ({ default: m.UpdatesSettings })),
);
