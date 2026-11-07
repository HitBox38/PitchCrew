import type { RuntimeAuthMethod } from '@pitchcrew/core';
import { FormSelect } from '@/FormSelect/index.tsx';
export const AuthMethodPicker = ({
  methods,
  selected,
  change,
  disabled,
}: {
  methods: RuntimeAuthMethod[];
  selected: string;
  change: (value: string) => void;
  disabled: boolean;
}) => (
  <>
    {methods.length > 1 ? (
      <FormSelect
        label="Sign-in method"
        value={selected}
        onValueChange={change}
        options={methods.map((method) => ({ value: method.id, label: method.label }))}
        disabled={disabled}
      />
    ) : null}
    {methods.find((method) => method.id === selected)?.description ? (
      <p className="quiet">{methods.find((method) => method.id === selected)?.description}</p>
    ) : null}
  </>
);
