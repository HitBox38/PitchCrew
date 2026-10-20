import { useState } from 'react';
import type { ProfileViewProps } from '../types.ts';

export const useProfileOrganization = ({ action }: Pick<ProfileViewProps, 'action'>) => {
  const change = async (
    body: { action: 'create'; path: string } | { action: 'move'; name: string; folder: string },
  ) => {
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
  };

  const [error, setError] = useState('');
  return { error, change, clearError: () => setError('') };
};
