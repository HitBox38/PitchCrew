import { useState } from 'react';
import type { ProfileViewProps } from '../types.ts';

export const useProfileOrganization = ({ action }: Pick<ProfileViewProps, 'action'>) => {
  const change = async (
    body:
      | { action: 'create'; path: string }
      | { action: 'move'; name: string; folder: string }
      | { action: 'rename-folder'; from: string; to: string }
      | { action: 'delete-folder'; path: string },
  ) => {
    setError('');
    try {
      await action(
        '/profile/organization',
        'POST',
        body,
        {
          create: 'Folder created',
          move: 'Note moved',
          'rename-folder': 'Folder renamed',
          'delete-folder': 'Folder deleted',
        }[body.action],
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
