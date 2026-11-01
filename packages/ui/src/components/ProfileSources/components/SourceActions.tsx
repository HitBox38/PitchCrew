import { Button } from '@pitchcrew/design-system/button';
import { LoaderCircle } from 'lucide-react';
import type { ProfileSourcesModel } from '../types.ts';

export const SourceActions = (c: ProfileSourcesModel) => {
  return (
    <div className="flex flex-wrap justify-end gap-2 pt-2">
      <Button variant="outline" disabled={c.busy} onClick={c.back}>
        Cancel
      </Button>
      <Button type="submit" disabled={c.busy || !c.canRead}>
        {c.progress ? (
          <LoaderCircle
            size={15}
            className="animate-spin motion-reduce:animate-none"
            aria-hidden="true"
          />
        ) : null}
        {c.progress
          ? c.progress.label
          : c.intent === 'project'
            ? 'Watch project'
            : 'Review documents'}
      </Button>
    </div>
  );
};
