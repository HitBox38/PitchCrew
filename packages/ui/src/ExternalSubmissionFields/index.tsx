import { Input } from '@/components/ui/input/components/Input.tsx';
import { Textarea } from '@/components/ui/textarea/components/Textarea.tsx';
import { useState } from 'react';
import { DateTimePicker } from '@/DateTimePicker/index.tsx';

export function ExternalSubmissionFields({ jobIdentifier = '' }: { jobIdentifier?: string }) {
  const [submittedAt, setSubmittedAt] = useState('');
  return (
    <>
      <DateTimePicker
        label="Submitted at"
        name="submittedAt"
        value={submittedAt}
        onValueChange={setSubmittedAt}
        required
      />
      <label>
        Job identifier <span className="optional">optional</span>
        <Input name="jobIdentifier" maxLength={200} defaultValue={jobIdentifier} />
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
}
