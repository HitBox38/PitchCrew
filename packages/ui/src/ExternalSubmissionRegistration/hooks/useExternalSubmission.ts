import { useWorkspaceStore } from '@/WorkspaceStore/index.ts';
import { useState, type FormEvent } from 'react';

export const useExternalSubmission = (cardId: string) => {
  const registerSubmission = async (event: FormEvent<HTMLFormElement>) => {
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
      setDirty(false);
      setRevision((value) => value + 1);
    } catch (failure) {
      setError(
        failure instanceof Error ? failure.message : 'Could not register external submission.',
      );
    }
  };

  const action = useWorkspaceStore((state) => state.action);
  const working = useWorkspaceStore((state) => state.working);
  const [error, setError] = useState('');
  const [dirty, setDirty] = useState(false);
  const [revision, setRevision] = useState(0);
  return { registerSubmission, error, working, dirty, setDirty, revision };
};
