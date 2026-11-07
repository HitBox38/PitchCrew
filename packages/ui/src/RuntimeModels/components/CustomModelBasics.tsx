import type { RefObject } from 'react';
import { Input } from '@pitchcrew/design-system/input';
import type { useCustomModelForm } from '../hooks/useCustomModelForm.ts';

export const CustomModelBasics = ({
  field,
  form,
  busy,
}: {
  field: RefObject<HTMLInputElement | null>;
  form: Omit<ReturnType<typeof useCustomModelForm>, 'field'>;
  busy: boolean;
}) => (
  <div className="settings-field-grid runtime-model-basics">
    <div>
      <label htmlFor="custom-model-selector">Model selector</label>
      <Input
        id="custom-model-selector"
        ref={field}
        value={form.value}
        onChange={(event) => form.setValue(event.target.value)}
        maxLength={100}
        required
        autoComplete="off"
        spellCheck={false}
        placeholder="provider/model-name"
        disabled={busy}
      />
    </div>
    <div>
      <label htmlFor="custom-model-display-name">Display name (optional)</label>
      <Input
        id="custom-model-display-name"
        value={form.label}
        onChange={(event) => form.setLabel(event.target.value)}
        maxLength={100}
        placeholder="Uses the selector when empty"
        disabled={busy}
      />
    </div>
  </div>
);
