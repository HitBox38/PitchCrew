import { useAnalytics } from './hooks/useAnalytics.ts';
import { useBackendObservations } from './hooks/useBackendObservations.ts';
import { useDiagnosticLeadership } from './leadership.ts';

export const Analytics = () => {
  useAnalytics();
  useDiagnosticLeadership();
  useBackendObservations();
  return null;
};
