import { Button } from '@/components/ui/button/components/Button.tsx';
import type { SkillsViewModel } from '@/SkillsView/types.ts';
import { groupedStarterErrors } from '../helpers.ts';

export const StarterSkillErrors = ({ data, working, action }: SkillsViewModel) => {
  return (
    <div className="skills-starter-errors" aria-live="polite">
      <strong>Some starter skills couldn’t be loaded</strong>
      <ul>
        {groupedStarterErrors(data.starterSkillErrors).map(({ error, names }) => (
          <li key={error}>
            {error}
            <span>{names.join(', ')}</span>
          </li>
        ))}
      </ul>
      <Button
        className="button small"
        disabled={working}
        onClick={() =>
          void action('/skills/starter/retry', 'POST', undefined, 'Retried starter skills').catch(
            () => {},
          )
        }
      >
        Retry
      </Button>
    </div>
  );
};
