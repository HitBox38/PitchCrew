import { Button } from '@/components/ui/button/components/Button.tsx';
import { LoaderCircle } from 'lucide-react';
import type { ProfileSourcesModel } from '../types.ts';

export const SourceActions = (c: ProfileSourcesModel) => {
  return (
    <div className="flex flex-wrap justify-end gap-2 border-t border-border pt-4">
      <Button variant="outline" disabled={c.busy} onClick={c.back}>
        Cancel
      </Button>
      <Button variant="default" className="primary" type="submit" disabled={c.busy || !c.canRead}>
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
