import { deepReviewStages } from '@pitchcrew/core/deep-review-labels';

const order = Object.keys(deepReviewStages) as (keyof typeof deepReviewStages)[];

/** Where a running review is: finished stages primary, the current one plum and breathing. */
export const ReviewStages = ({ stage }: { stage: keyof typeof deepReviewStages }) => {
  const current = order.indexOf(stage);
  return (
    <ol className="deep-review-stages" aria-label="Review stages">
      {order.map((id, index) => (
        <li key={id} aria-current={index === current ? 'step' : undefined}>
          <span
            className="clay-bead"
            data-size="sm"
            data-tone={index < current ? 'done' : index === current ? 'plum' : undefined}
            data-live={index === current ? '' : undefined}
            data-empty={index > current ? '' : undefined}
            aria-hidden="true"
          />
          {deepReviewStages[id]}
        </li>
      ))}
    </ol>
  );
};
