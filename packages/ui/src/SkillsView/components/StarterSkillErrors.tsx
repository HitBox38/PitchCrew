import { Button } from '@/components/ui/button/components/Button.tsx';
import type { StarterSkillErrorsProps } from '@/SkillsView/types.ts';
import { groupedStarterErrors } from '../helpers.ts';

export const StarterSkillErrors = ({ data, working, action }: StarterSkillErrorsProps) => {
  return (
    <div className="starter-skill-errors" aria-live="polite">
      <h3>Some starter skills could not be loaded</h3>
      <ul>
        {groupedStarterErrors(data.starterSkillErrors).map(({ error, names }) => (
          <li key={error}>
            {error}
            <span className="starter-skill-error-names">{names.join(', ')}</span>
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
        Retry missing starter skills
      </Button>
    </div>
  );
};
