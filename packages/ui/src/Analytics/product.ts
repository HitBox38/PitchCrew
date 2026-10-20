import type { Snapshot } from '@pitchcrew/core';
import { setupProgress } from '../Onboarding/helpers.ts';

/** Reuse the actual onboarding readiness rules; raw snapshot values never leave this function. */
export const productSetupProperties = (data: Snapshot | null) => {
  if (!data) return undefined;
  const progress = setupProgress(data);
  return { profile_ready: progress.profile, crew_ready: progress.crew, job_ready: progress.job };
};
