import { Button } from '@/components/ui/button/components/Button.tsx';
import type { useSkillUpdate } from '../hooks/useSkillUpdate.ts';

export function SkillUpdateActions(c: ReturnType<typeof useSkillUpdate>) {
  return (
    <footer className="profile-import-footer flex flex-wrap justify-end gap-2.5">
      <Button className="button" onClick={c.close} disabled={c.working}>
        Close
      </Button>
      {c.upstreamChanged ? (
        <Button
          className="button"
          onClick={() => void c.dismiss()}
          disabled={c.working || Boolean(c.error)}
        >
          Keep mine
        </Button>
      ) : null}
      {c.error ? (
        <Button className="button" onClick={() => void c.check()} disabled={c.loading || c.working}>
          Check again
        </Button>
      ) : null}
      {c.review?.changed ? (
        <Button
          className="button primary"
          onClick={() => void c.approve()}
          disabled={c.working || Boolean(c.error)}
        >
          {c.working ? 'Updating…' : 'Replace with upstream version'}
        </Button>
      ) : null}
    </footer>
  );
}
