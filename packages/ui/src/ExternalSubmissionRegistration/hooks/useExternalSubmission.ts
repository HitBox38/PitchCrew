import { useWorkspaceStore } from '@/WorkspaceStore/index.ts';
import { useState, type FormEvent } from 'react';

export function useExternalSubmission(cardId: string) {
  const action = useWorkspaceStore((state) => state.action);
  const working = useWorkspaceStore((state) => state.working);
  const [error, setError] = useState('');
  async function registerSubmission(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setError('');
    try {
      await action(
        `/tracking/applications/${cardId}/external`,
        'POST',
        {
          submittedAt: new Date(String(form.get('submittedAt'))).toISOString(),
          jobIdentifier: String(form.get('jobIdentifier') ?? ''),
          note: form.get('note'),
        },
        'External submission registered',
      );
    } catch (failure) {
      setError(
        failure instanceof Error ? failure.message : 'Could not register external submission.',
      );
    }
  }
  return { registerSubmission, error, working };
}
