import type { ProfileViewModel } from '../types.ts';

export function ProfileOrigin({
  name,
  sourceController,
}: Pick<ProfileViewModel, 'name' | 'sourceController'>) {
  const file = sourceController.sources
    .flatMap((source) => source.files)
    .find((entry) => entry.name === name);
  if (!file) return null;
  return (
    <div className="profile-origin">
      <span>
        Source:{' '}
        <a href={file.url} target="_blank" rel="noreferrer">
          {file.path}
        </a>
      </span>
      <span>
        Editing this note changes your local copy. Review updates to pull from its source again.
      </span>
    </div>
  );
}
