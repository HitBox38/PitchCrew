import { FormSelect } from '@/FormSelect/index.tsx';
import { Button } from '@/components/ui/button/components/Button.tsx';
import { Input } from '@/components/ui/input/components/Input.tsx';
import type { Card } from '@pitchcrew/core';
import { useTagMerge } from '../hooks/useTagMerge.ts';
import { TagMergeConfirm } from './TagMergeConfirm.tsx';

export function TagMerge({ cards, tags }: { cards: Card[]; tags: string[] }) {
  const merge = useTagMerge(cards);
  return (
    <div>
      <h3>Merge tags</h3>
      <p className="quiet">
        Move every job from one tag to another and drop the old tag. Jobs keep at most 10 tags.
      </p>
      <div className="mt-2 flex flex-wrap items-end gap-3">
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
        <p className="quiet mt-2">
          {merge.affected.length} {merge.affected.length === 1 ? 'job has' : 'jobs have'} this tag.
        </p>
      ) : null}
      {merge.confirming ? <TagMergeConfirm merge={merge} /> : null}
    </div>
  );
}
