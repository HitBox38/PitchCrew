import { Input } from '@pitchcrew/design-system/input';
import { Textarea } from '@pitchcrew/design-system/textarea';
import { useState } from 'react';
import { DateTimePicker } from '@/DateTimePicker/index.tsx';

export const ExternalSubmissionFields = ({
  jobIdentifier = '',
  onChange,
}: {
  jobIdentifier?: string;
  onChange?: () => void;
}) => {
  const [submittedAt, setSubmittedAt] = useState('');
  const [initialIdentifier] = useState(jobIdentifier);
  return (
    <>
      <DateTimePicker
        label="Submitted at"
        name="submittedAt"
        value={submittedAt}
        onValueChange={(value) => {
          setSubmittedAt(value);
          onChange?.();
        }}
        required
      />
      <label>
        Job identifier <span className="optional">optional</span>
        <Input name="jobIdentifier" maxLength={200} defaultValue={initialIdentifier} />
      </label>
      <label>
        Submission evidence or note
        <Textarea
          name="note"
          maxLength={2000}
          required
          placeholder="Where you applied and how you confirmed submission"
        />
      </label>
    </>
  );
};
