import type { ReviewPerspective } from '@pitchcrew/core/deep-review-labels';
import { originalReviewPerspectives, reviewPerspectives } from '@pitchcrew/core/deep-review-labels';
import { Checkbox } from '@pitchcrew/design-system/checkbox';

const specialists = (Object.keys(reviewPerspectives) as ReviewPerspective[]).filter(
  (id) => !(originalReviewPerspectives as readonly string[]).includes(id),
);
const groups = [
  { label: 'The seven perspectives', ids: [...originalReviewPerspectives] as ReviewPerspective[] },
  { label: 'Specialists', ids: specialists },
];

/** Optional second opinions, grouped so eleven choices read as two short lists. */
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
  const selectedIds = new Set(selected);
  return (
    <section className="grid gap-3">
      <div className="grid gap-1">
        <label className="flex cursor-pointer items-start gap-3">
          <Checkbox checked={enabled} onCheckedChange={changeEnabled} />
          Request targeted second opinions
        </label>
        <p className="quiet pl-7">Otherwise Reviewer picks by relevance and impact.</p>
      </div>
      {enabled ? (
        <fieldset className="deep-review-opinion-choices">
          <legend className="sr-only">Choose perspectives, or use relevance and impact</legend>
          {groups.map((group) => (
            <div key={group.label} className="grid content-start gap-1.5">
              <p className="quiet">{group.label}</p>
              {group.ids.map((id) => (
                <label className="flex cursor-pointer items-start gap-3" key={id}>
                  <Checkbox
                    checked={selectedIds.has(id)}
                    onCheckedChange={(checked) =>
                      changeSelected(
                        checked ? [...selected, id] : selected.filter((value) => value !== id),
                      )
                    }
                  />
                  {reviewPerspectives[id]}
                </label>
              ))}
            </div>
          ))}
        </fieldset>
      ) : null}
    </section>
  );
};
