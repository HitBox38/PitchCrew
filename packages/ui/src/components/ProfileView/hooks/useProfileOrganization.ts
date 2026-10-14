import { useState } from 'react';
import type { ProfileViewProps } from '../types.ts';

export function useProfileOrganization({ action }: Pick<ProfileViewProps, 'action'>) {
  const [error, setError] = useState('');
  async function change(
    body: { action: 'create'; path: string } | { action: 'move'; name: string; folder: string },
  ) {
    setError('');
    try {
      await action(
        '/profile/organization',
        'POST',
        body,
        body.action === 'create' ? 'Folder created' : 'Note moved',
      );
      return true;
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Could not organize profile notes.');
      return false;
    }
  }
  return { error, change, clearError: () => setError('') };
}
