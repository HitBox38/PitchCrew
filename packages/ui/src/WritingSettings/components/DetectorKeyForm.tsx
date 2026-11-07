import { useEffect, useRef, useState, type FormEvent } from 'react';
import type { DetectorProvider } from '@pitchcrew/core';
import { Button } from '@pitchcrew/design-system/button';
import { Input } from '@pitchcrew/design-system/input';
import { detectorEntries } from './detector-entries.ts';

/** Enter a key once; it is stored on the daemon host only and never shown again. */
export const DetectorKeyForm = ({
  provider,
  working,
  save,
  cancel,
}: {
  provider: DetectorProvider;
  working: boolean;
  save: (key: string, email: string) => Promise<void>;
  cancel: () => void;
}) => {
  const entry = detectorEntries[provider];
  const [key, setKey] = useState('');
  const [email, setEmail] = useState('');
  const keyField = useRef<HTMLInputElement>(null);
  useEffect(() => {
    keyField.current?.focus();
  }, [provider]);
  const submit = (event: FormEvent) => {
    event.preventDefault();
    void save(key.trim(), email.trim()).catch(() => {});
  };
  return (
    <form className="settings-form detector-key-form" onSubmit={submit}>
      {entry.secondary ? (
        <label>
          {entry.secondary}
          <Input
            ref={keyField}
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="off"
            required
            maxLength={200}
          />
        </label>
      ) : null}
      <label>
        {entry.name} API key
        <Input
          ref={entry.secondary ? undefined : keyField}
          id={`detector-${provider}-api-key`}
          type="password"
          value={key}
          onChange={(e) => setKey(e.target.value)}
          autoComplete="off"
          required
          minLength={8}
          maxLength={400}
        />
      </label>
      <div className="settings-form-actions">
        <Button type="button" variant="ghost" className="ml-auto" onClick={cancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={working || key.trim().length < 8}>
          Save key
        </Button>
      </div>
    </form>
  );
};
