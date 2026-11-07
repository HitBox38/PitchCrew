import { useId, useState } from 'react';
import { Input } from '@pitchcrew/design-system/input';
import { Button } from '@pitchcrew/design-system/button';

export const AuthCredentialField = ({
  field,
  value,
  change,
  working,
}: {
  field: { name: string; label: string; secret: boolean };
  value: string;
  change: (value: string) => void;
  working: boolean;
}) => {
  const id = useId();
  const [reveal, setReveal] = useState(false);
  return (
    <div className="settings-stack">
      <label htmlFor={id}>{field.label}</label>
      <Input
        id={id}
        type={field.secret && !reveal ? 'password' : 'text'}
        value={value}
        maxLength={16384}
        autoComplete="off"
        disabled={working}
        aria-describedby={`${id}-hint`}
        onChange={(event) => change(event.target.value)}
      />
      <p id={`${id}-hint`} className="quiet">
        Sent only to this sign-in attempt; not saved to conversation history.
      </p>
      {field.secret ? (
        <Button
          variant="ghost"
          size="sm"
          disabled={working || !value}
          aria-pressed={reveal}
          onClick={() => setReveal(!reveal)}
        >
          {reveal ? 'Hide typed value' : 'Show typed value'}
        </Button>
      ) : null}
    </div>
  );
};
