import { useId, useState } from 'react';
import type { RuntimeConnectionFieldState } from '@pitchcrew/core';
import { Input } from '@pitchcrew/design-system/input';
import { Button } from '@pitchcrew/design-system/button';
import { FormSelect } from '@/FormSelect/index.tsx';

export const ConnectionValue = ({
  field,
  value,
  working,
  change,
  describedBy,
}: {
  field: RuntimeConnectionFieldState;
  value: string;
  working: boolean;
  change: (value: string) => void;
  describedBy: string;
}) => {
  const [reveal, setReveal] = useState(false);
  const id = useId();
  if (field.choices)
    return (
      <FormSelect
        label={`Value for ${field.name}`}
        value={value}
        onValueChange={change}
        disabled={working}
        id={id}
        describedBy={describedBy}
        options={[
          { value: '', label: 'Choose a value' },
          ...(!value || field.choices.includes(value)
            ? []
            : [{ value, label: `Current daemon value: ${value}` }]),
          ...field.choices.map((choice) => ({ value: choice, label: choice })),
        ]}
      />
    );
  return (
    <div className="field">
      <label htmlFor={id}>{field.secret ? 'New secret value' : 'Value'}</label>
      <Input
        id={id}
        aria-describedby={describedBy}
        type={field.secret && !reveal ? 'password' : 'text'}
        value={value}
        onChange={(event) => change(event.target.value)}
        disabled={working}
        autoComplete="off"
        spellCheck={false}
        maxLength={16384}
        placeholder={
          field.invalidValue
            ? 'Invalid daemon value is hidden. Enter a replacement.'
            : field.secret && field.configured
              ? 'Configured value is hidden. Enter a replacement.'
              : field.placeholder
        }
      />
      {field.secret ? (
        <div>
          <Button
            variant="ghost"
            size="sm"
            disabled={working}
            aria-pressed={reveal}
            onClick={() => setReveal(!reveal)}
          >
            {reveal ? 'Hide typed value' : 'Show typed value'}
          </Button>
        </div>
      ) : null}
    </div>
  );
};
