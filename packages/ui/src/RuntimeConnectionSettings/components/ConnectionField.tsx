import type { RuntimeConnectionFieldState } from '@pitchcrew/core';
import { useId } from 'react';
import { Button } from '@pitchcrew/design-system/button';
import { ConnectionValue } from './ConnectionValue.tsx';
import { connectionFieldDescription } from '../helpers.ts';

export const ConnectionField = ({
  field,
  draft,
  changed,
  incomplete,
  working,
  change,
  typeValue,
  undo,
}: {
  field: RuntimeConnectionFieldState;
  draft: string | null | undefined;
  changed: boolean;
  incomplete: boolean;
  working: boolean;
  change: (value: string | null) => void;
  typeValue: (value: string) => void;
  undo: () => void;
}) => {
  const descriptionId = useId();
  return (
    <fieldset
      className="settings-stack runtime-connection-field"
      aria-label={field.label}
      aria-describedby={descriptionId}
    >
      <div>
        <strong>{field.name}</strong>
        <p id={descriptionId} className="quiet">
          <span className="sr-only">{field.name}: </span>
          {connectionFieldDescription(field)}
        </p>
      </div>
      <ConnectionValue
        key={field.name}
        field={field}
        working={working}
        value={
          changed ? (draft ?? '') : field.secret || field.invalidValue ? '' : (field.value ?? '')
        }
        change={typeValue}
        describedBy={descriptionId}
      />
      {changed ? (
        <p className="quiet">
          {incomplete
            ? 'Enter a value, undo this change, or choose Disable for this runtime.'
            : draft === null
              ? 'After saving, this runtime will use the daemon value, if one exists.'
              : draft === ''
                ? 'After saving, this variable will be disabled, including an inherited value.'
                : 'This replacement will apply after you save.'}
        </p>
      ) : null}
      <div className="settings-row-actions">
        {field.source === 'saved' || field.source === 'disabled' ? (
          <Button variant="outline" size="sm" disabled={working} onClick={() => change(null)}>
            Use daemon value
          </Button>
        ) : null}
        {field.source !== 'disabled' && (field.source !== 'unset' || changed) ? (
          <Button variant="ghost" size="sm" disabled={working} onClick={() => change('')}>
            Disable for this runtime
          </Button>
        ) : null}
        {changed ? (
          <Button variant="ghost" size="sm" disabled={working} onClick={undo}>
            Undo this change
          </Button>
        ) : null}
      </div>
    </fieldset>
  );
};
