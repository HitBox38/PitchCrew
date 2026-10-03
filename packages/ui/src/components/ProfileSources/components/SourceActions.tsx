import { Button } from '@/components/ui/button/components/Button.tsx';
import type { ProfileSourcesModel } from '../types.ts';

export function SourceActions(c: ProfileSourcesModel) {
  return (
    <div className="form-footer mt-0.5 flex flex-wrap justify-end gap-2.5 border-t border-border pt-4">
      <Button variant="outline" disabled={c.busy} onClick={() => c.setProvider(null)}>
        Cancel
      </Button>
      {c.provider === 'github' ? (
        <Button
          variant="outline"
          disabled={c.busy || !c.canRead}
          onClick={() => void c.watchProject(c.repository, c.path, c.branch)}
        >
          Watch project changes
        </Button>
      ) : null}
      <Button type="submit" disabled={c.busy || !c.canRead}>
        {c.busy ? 'Reading documents…' : 'Review documents'}
      </Button>
    </div>
  );
}
