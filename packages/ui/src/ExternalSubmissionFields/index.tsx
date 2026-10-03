import { Input } from '@/components/ui/input/components/Input.tsx';
import { Textarea } from '@/components/ui/textarea/components/Textarea.tsx';

export function ExternalSubmissionFields({ jobIdentifier = '' }: { jobIdentifier?: string }) {
  return (
    <>
      <label>
        Submitted at
        <Input name="submittedAt" type="datetime-local" required />
      </label>
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
