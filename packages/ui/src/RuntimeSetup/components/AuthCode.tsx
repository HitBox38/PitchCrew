import { useEffect, useRef, useState } from 'react';
import { Input } from '@pitchcrew/design-system/input';
import { Button } from '@pitchcrew/design-system/button';
import type { RuntimeSetupRequest } from '../types.ts';

export const AuthCode = ({
  flowId,
  working,
  request,
  visible,
  interactionId,
  label,
}: {
  flowId: string;
  working: boolean;
  request: RuntimeSetupRequest;
  visible: boolean;
  interactionId?: string;
  label?: string;
}) => {
  const [code, setCode] = useState('');
  const [reveal, setReveal] = useState(false);
  const field = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (visible) field.current?.focus();
  }, [visible]);
  return (
    <form
      className="settings-form"
      onSubmit={(event) => {
        event.preventDefault();
        void request(
          '/auth/respond',
          interactionId
            ? { flowId, interactionId, response: { type: 'code', code } }
            : { flowId, code },
        ).then((saved) => {
          if (saved) {
            setCode('');
          }
        });
      }}
    >
      <label htmlFor="runtime-auth-code">{label ?? 'Code from the sign-in page'}</label>
      <Input
        id="runtime-auth-code"
        ref={field}
        type={reveal ? 'text' : 'password'}
        value={code}
        onChange={(event) => setCode(event.target.value)}
        maxLength={2048}
        autoComplete="off"
        disabled={working}
      />
      <p className="quiet">
        Sent only to this native sign-in flow. Pitchcrew does not save the code.
      </p>
      <div className="settings-row-actions">
        <Button
          variant="ghost"
          disabled={working}
          aria-pressed={reveal}
          onClick={() => setReveal(!reveal)}
        >
          {reveal ? 'Hide code' : 'Show code'}
        </Button>
        <Button type="submit" disabled={working || !code.trim()}>
          Continue sign-in
        </Button>
      </div>
    </form>
  );
};
