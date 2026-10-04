import type { OnboardingState } from '@pitchcrew/core';

export interface OnboardingActions {
  working: boolean;
  error: string;
  save: (status: OnboardingState['status'], step?: OnboardingState['step']) => Promise<void>;
}
