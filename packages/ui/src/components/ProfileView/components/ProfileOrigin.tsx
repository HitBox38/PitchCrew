import { ExternalLink } from 'lucide-react';
import type { ProfileViewModel } from '../types.ts';

/** In the status bar: the source document this note is a local copy of. */
export const ProfileOrigin = ({
  activeSavedName,
  sourceController,
}: Pick<ProfileViewModel, 'activeSavedName' | 'sourceController'>) => {
  const file = sourceController.sources
    .flatMap((source) => source.files)
    .find((entry) => entry.name === activeSavedName);
  if (!file) return null;
  return (
    <span
      className="profile-origin"
      title="Local copy of a source document. Edits stay on this device; source updates need your review."
    >
      From{' '}
      <a href={file.url} target="_blank" rel="noreferrer">
        {file.path} <ExternalLink size={11} aria-hidden="true" />
      </a>
    </span>
  );
};
