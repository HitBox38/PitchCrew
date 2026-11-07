import { useState } from 'react';
import type { RuntimeAuthInteraction } from '@pitchcrew/core';
import { Button } from '@pitchcrew/design-system/button';
import type { RuntimeSetupRequest } from '../types.ts';
import { AuthCredentialField } from './AuthCredentialField.tsx';

export const AuthCredentials = ({
  flowId,
  interaction,
  request,
  working,
}: {
  flowId: string;
  interaction: Extract<RuntimeAuthInteraction, { type: 'credentials' }>;
  request: RuntimeSetupRequest;
  working: boolean;
}) => {
  const [values, setValues] = useState<Record<string, string>>({});
  return (
    <form
      className="settings-form ph-no-capture"
      onSubmit={(event) => {
        event.preventDefault();
        void request('/auth/respond', {
          flowId,
          interactionId: interaction.id,
          response: { type: 'credentials', values },
        }).then((ok) => {
          if (ok) setValues({});
        });
      }}
    >
      {interaction.fields.map((field) => (
        <AuthCredentialField
          key={field.name}
          field={field}
          working={working}
          value={values[field.name] ?? ''}
          change={(value) => setValues((current) => ({ ...current, [field.name]: value }))}
        />
      ))}
      <div>
        <Button type="submit" disabled={working}>
          Continue sign-in
        </Button>
      </div>
    </form>
  );
};
