import { Button } from '@/components/ui/button/components/Button.tsx';
import type { useSkillUpdate } from '../hooks/useSkillUpdate.ts';

export const SkillUpdateActions = (c: ReturnType<typeof useSkillUpdate>) => {
  return (
    <footer className="skills-update-footer">
      <Button className="button" onClick={c.close} disabled={c.working}>
        Close
      </Button>
      {c.error ? (
        <Button className="button" onClick={() => void c.check()} disabled={c.loading || c.working}>
          Check again
        </Button>
      ) : null}
      {c.upstreamChanged ? (
        <Button
          className="button"
          onClick={() => void c.dismiss()}
          disabled={c.working || Boolean(c.error)}
        >
          Keep mine
        </Button>
      ) : null}
      {c.review?.changed ? (
        <Button
          className="button primary"
          onClick={() => void c.approve()}
          disabled={c.working || Boolean(c.error)}
        >
          {c.working ? 'Updating…' : 'Use this update'}
        </Button>
      ) : null}
    </footer>
  );
};
