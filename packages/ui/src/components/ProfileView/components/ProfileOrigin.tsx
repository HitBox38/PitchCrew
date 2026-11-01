import { ExternalLink } from 'lucide-react';
import type { ProfileViewModel } from '../types.ts';

export const ProfileOrigin = ({
  activeSavedName,
  sourceController,
}: Pick<ProfileViewModel, 'activeSavedName' | 'sourceController'>) => {
  const file = sourceController.sources
    .flatMap((source) => source.files)
    .find((entry) => entry.name === activeSavedName);
  if (!file) return null;
  return (
    <p className="profile-origin">
      Local copy of{' '}
      <a href={file.url} target="_blank" rel="noreferrer">
        {file.path} <ExternalLink size={12} aria-hidden="true" />
      </a>
      . Edits stay on this device; source updates need your review.
    </p>
  );
};
