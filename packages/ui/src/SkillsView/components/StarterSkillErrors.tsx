import { Button } from '@/components/ui/button/components/Button.tsx';
import type { StarterSkillErrorsProps } from '@/SkillsView/types.ts';

export function StarterSkillErrors({ data, working, action }: StarterSkillErrorsProps) {
  return (
    <div className="starter-skill-errors" aria-live="polite">
      <h3>Some starter skills could not be loaded</h3>
      <ul>
        {data.starterSkillErrors.map((item) => (
          <li key={item.name}>
            <strong>{item.name}</strong>: {item.error}
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
}
