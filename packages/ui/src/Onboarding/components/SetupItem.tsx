import { Button } from '@pitchcrew/design-system/button';

/** A 64px setup row: moss when done, ochre for the next step, an empty socket after it. */
export const SetupItem = ({
  title,
  description,
  done,
  current,
  label,
  action,
  disabled,
}: {
  title: string;
  description: string;
  done: boolean;
  current: boolean;
  label: string;
  action: () => void;
  disabled: boolean;
}) => (
  <li className="onboarding-item" data-done={done || undefined}>
    <span
      className="clay-bead"
      data-tone={done ? 'moss' : current ? 'ochre' : undefined}
      data-empty={done || current ? undefined : ''}
      aria-hidden="true"
    />
    <div className="min-w-0">
      <h3>
        {title}
        <span className="sr-only">{done ? ': Complete' : ': To do'}</span>
      </h3>
      <p>{description}</p>
    </div>
    <Button variant={done ? 'ghost' : 'outline'} size="sm" disabled={disabled} onClick={action}>
      {done ? 'Review' : label}
    </Button>
  </li>
);
