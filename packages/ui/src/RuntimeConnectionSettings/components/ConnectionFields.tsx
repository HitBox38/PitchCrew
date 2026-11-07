import { useState } from 'react';
import { FormSelect } from '@/FormSelect/index.tsx';
import type { useRuntimeConnection } from '../hooks/useRuntimeConnection.ts';
import { connectionChangeLabel, connectionOptionLabel } from '../helpers.ts';
import { ConnectionField } from './ConnectionField.tsx';

export const ConnectionFields = ({
  model,
  working,
}: {
  model: ReturnType<typeof useRuntimeConnection>;
  working: boolean;
}) => {
  const [selected, setSelected] = useState('');
  const fields = model.state?.fields ?? [];
  const field = fields.find((entry) => entry.name === selected) ?? fields[0];
  if (!field) return null;
  return (
    <>
      <FormSelect
        label="Authentication variable"
        value={field.name}
        onValueChange={setSelected}
        disabled={model.working}
        options={fields.map((entry) => ({
          value: entry.name,
          label: connectionOptionLabel(entry, Object.hasOwn(model.changes, entry.name)),
        }))}
      />
      <ConnectionField
        field={field}
        draft={model.changes[field.name]}
        changed={Object.hasOwn(model.changes, field.name)}
        incomplete={!!model.incomplete[field.name]}
        working={working}
        change={(value) => model.change(field.name, value)}
        typeValue={(value) => model.typeValue(field.name, value)}
        undo={() => model.undo(field.name)}
      />
      {model.dirty ? (
        <div className="border-t pt-3">
          <p className="quiet">Changes to save</p>
          <ul className="text-sm">
            {Object.entries(model.changes).map(([name, value]) => (
              <li key={name}>
                {fields.find((entry) => entry.name === name)?.label ?? name}:{' '}
                {connectionChangeLabel(value, !!model.incomplete[name])}
              </li>
            ))}
          </ul>
          {Object.keys(model.incomplete).length ? (
            <p className="quiet">
              Enter a value for each incomplete field, undo its change, or explicitly disable it
              before saving.
            </p>
          ) : null}
        </div>
      ) : null}
    </>
  );
};
