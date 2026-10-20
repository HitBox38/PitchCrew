import { Button } from '@/components/ui/button/components/Button.tsx';
import { Checkbox } from '@/components/ui/checkbox/index.tsx';
import { Textarea } from '@/components/ui/textarea/index.tsx';
import type { ExtractedJob } from '@pitchcrew/core';

export const RequirementFields = ({
  value,
  change,
}: {
  value: ExtractedJob['requirements'];
  change: (value: ExtractedJob['requirements']) => void;
}) => {
  const update = (id: string, patch: Partial<ExtractedJob['requirements'][number]>) =>
    change(value.map((entry) => (entry.id === id ? { ...entry, ...patch } : entry)));
  return (
    <section className="grid gap-3">
      <h4>Application requirements</h4>
      <p className="quiet">
        Confirm the questions and format the employer requests. Personal answers are saved for this
        application.
      </p>
      {value.map((entry, index) => (
        <fieldset key={entry.id} className="grid gap-2 rounded-md border p-3">
          <legend>Requirement {index + 1}</legend>
          <label className="grid gap-1">
            Question or instruction
            <Textarea
              value={entry.question}
              maxLength={2000}
              onChange={(event) => update(entry.id, { question: event.target.value })}
            />
          </label>
          <div className="flex flex-wrap gap-4">
            <label className="checkbox-label">
              <Checkbox
                checked={entry.required}
                onCheckedChange={(checked) => update(entry.id, { required: checked })}
              />
              Required
            </label>
            <label className="checkbox-label">
              <Checkbox
                checked={entry.personal}
                onCheckedChange={(checked) => update(entry.id, { personal: checked })}
              />
              Needs my personal answer
            </label>
          </div>
          {entry.personal ? (
            <label className="grid gap-1">
              Your answer
              <Textarea
                value={entry.answer}
                maxLength={8000}
                onChange={(event) => update(entry.id, { answer: event.target.value })}
              />
            </label>
          ) : null}
          <Button
            className="text-button danger min-h-8 justify-self-start"
            variant="ghost"
            onClick={() => change(value.filter((item) => item.id !== entry.id))}
          >
            Remove requirement
          </Button>
        </fieldset>
      ))}
      <Button
        className="justify-self-start"
        disabled={value.length >= 40}
        variant="outline"
        onClick={() =>
          change([
            ...value,
            {
              id: `question-${crypto.randomUUID()}`,
              question: '',
              required: true,
              personal: false,
              answer: '',
            },
          ])
        }
      >
        Add requirement
      </Button>
    </section>
  );
};
