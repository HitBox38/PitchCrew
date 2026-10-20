import type { ReviewPerspective } from '@pitchcrew/core/deep-review-labels';
import { reviewPerspectives } from '@pitchcrew/core/deep-review-labels';
import { Checkbox } from '@/components/ui/checkbox/components/Checkbox.tsx';
export const ReviewSecondOpinions = ({
  enabled,
  changeEnabled,
  selected,
  changeSelected,
}: {
  enabled: boolean;
  changeEnabled: (enabled: boolean) => void;
  selected: ReviewPerspective[];
  changeSelected: (selected: ReviewPerspective[]) => void;
}) => {
  return (
    <section className="grid gap-3">
      <label className="flex cursor-pointer items-start gap-3">
        <Checkbox checked={enabled} onCheckedChange={changeEnabled} />
        Request targeted second opinions
      </label>
      {enabled ? (
        <fieldset className="grid gap-2">
          <legend className="mb-2">Choose perspectives, or use relevance and impact</legend>
          {(Object.keys(reviewPerspectives) as ReviewPerspective[]).map((id) => (
            <label className="flex cursor-pointer items-start gap-3" key={id}>
              <Checkbox
                checked={selected.includes(id)}
                onCheckedChange={(checked) =>
                  changeSelected(
                    checked ? [...selected, id] : selected.filter((value) => value !== id),
                  )
                }
              />
              {reviewPerspectives[id]}
            </label>
          ))}
        </fieldset>
      ) : null}
    </section>
  );
};
