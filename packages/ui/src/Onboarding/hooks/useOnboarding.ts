import type { OnboardingState } from '@pitchcrew/core';
import { useState } from 'react';
import { useWorkspaceStore } from '@/WorkspaceStore/index.ts';
import { useShallow } from 'zustand/react/shallow';

export function useOnboarding() {
  const { data, action, working } = useWorkspaceStore(
    useShallow((state) => ({
      data: state.data,
      action: state.action,
      working: state.working,
    })),
  );
  const [error, setError] = useState('');
  async function save(status: OnboardingState['status'], step: OnboardingState['step'] = 0) {
    if (working) return;
    setError('');
    try {
      await action('/onboarding', 'PUT', { version: 1, status, step });
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : 'Could not save setup progress. Try again.',
      );
    }
  }
  return { data, working, error, save };
}
