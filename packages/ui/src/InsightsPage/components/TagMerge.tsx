import { FormSelect } from '@/FormSelect/index.tsx';
import { Button } from '@/components/ui/button/components/Button.tsx';
import { Input } from '@/components/ui/input/components/Input.tsx';
import type { Card } from '@pitchcrew/core';
import { useTagMerge } from '../hooks/useTagMerge.ts';
import { TagMergeConfirm } from './TagMergeConfirm.tsx';

export const TagMerge = ({ cards, tags }: { cards: Card[]; tags: string[] }) => {
  const merge = useTagMerge(cards);
  return (
    <div className="insights-tidy-part">
      <h3>Merge tags</h3>
      <p className="insights-note">
        Every job moves to the new tag and drops the old one. Jobs keep at most 10 tags.
      </p>
      <div className="insights-tidy-row">
        <FormSelect
          label="Old tag"
          value={merge.from}
          options={[
            { value: '', label: 'Choose a tag' },
            ...tags.map((tag) => ({ value: tag, label: tag })),
          ]}
          onValueChange={merge.setFrom}
        />
        <label className="field">
          New tag
          <Input
            value={merge.to}
            maxLength={40}
            placeholder="Existing or new tag"
            onChange={(event) => merge.setTo(event.target.value)}
          />
        </label>
        <Button
          className="button"
          disabled={!merge.ready}
          onClick={() => merge.setConfirming(true)}
        >
          Review merge
        </Button>
      </div>
      {merge.from ? (
        <p className="insights-note">
          {merge.affected.length} {merge.affected.length === 1 ? 'job has' : 'jobs have'} this tag.
        </p>
      ) : null}
      {merge.confirming ? <TagMergeConfirm merge={merge} /> : null}
    </div>
  );
};
