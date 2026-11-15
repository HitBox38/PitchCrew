import { useRef } from 'react';
import { Input } from '@pitchcrew/design-system/input';

/** A name input; with a suffix (".md") shown fixed at its end and selected on first focus. */
export const ProfileNameField = ({
  value,
  onChange,
  suffix,
  invalid,
}: {
  value: string;
  onChange: (value: string) => void;
  suffix: string;
  invalid: boolean;
}) => {
  const selected = useRef(false);
  return (
    <span className="profile-name-field" data-suffix={suffix || undefined}>
      <Input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        // Like F2 in a code editor: the name is selected, ready to retype.
        onFocus={(event) => {
          if (selected.current) return;
          selected.current = true;
          event.currentTarget.select();
        }}
        autoComplete="off"
        spellCheck={false}
        maxLength={100}
        required
        aria-invalid={invalid || undefined}
      />
      {suffix ? <span className="profile-name-suffix">{suffix}</span> : null}
    </span>
  );
};
