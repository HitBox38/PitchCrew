import { Button } from '@pitchcrew/design-system/button';
import { SourceProgress } from '@/components/ProfileSources/components/SourceProgress.tsx';
import type { ProfileViewModel } from '../types.ts';

export const ProfileMetadataStatus = ({
  sourceController: sources,
}: Pick<ProfileViewModel, 'sourceController'>) => {
  if (sources.loaded) return null;
  return (
    <div className="grid gap-2 px-2 py-2">
      {sources.loading ? <SourceProgress label="Loading note information…" /> : null}
      {sources.listError ? (
        <>
          <p role="alert" className="form-error">
            {sources.listError}
          </p>
          <Button size="sm" disabled={sources.loading} onClick={() => void sources.refresh()}>
            Retry loading note information
          </Button>
        </>
      ) : null}
    </div>
  );
};
