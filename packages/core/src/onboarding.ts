/** Workspace preferences, independent of the append-only board event log. */
export interface OnboardingState {
  version: 1;
  status: 'welcome' | 'setup' | 'dismissed' | 'completed';
  step: 0 | 1;
}
