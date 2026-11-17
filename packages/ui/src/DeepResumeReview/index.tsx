import type { Card, Snapshot } from '@pitchcrew/core';
import { useDeepReviews } from './hooks/useDeepReviews.ts';
import { ReviewReport } from './components/ReviewReport.tsx';
import { Button } from '@pitchcrew/design-system/button';

/**
 * Saved deep reviews for this job. The Reviews step introduces the feature and its launch button,
 * so this shows nothing until a review exists; the history list appears only with two or more.
 */
export const DeepResumeReview = ({ card, data }: { card: Card; data: Snapshot }) => {
  const revision = data.runs
    .filter((run) => run.cardId === card.id && run.deepReviewId)
    .map((run) => `${run.id}:${run.status}:${run.message}`)
    .join('|');
  const model = useDeepReviews(card.id, revision);
  if (model.error)
    return (
      <div role="alert" className="grid justify-items-start gap-2">
        <p>{model.error}</p>
        <Button variant="outline" size="sm" onClick={model.retry}>
          Retry deep reviews
        </Button>
      </div>
    );
  if (!model.list) return <output className="quiet">Loading deep reviews…</output>;
  const { reviews, nextOffset } = model.list;
  if (!reviews.length && !model.page) return null;
  return (
    <div className="deep-review-reports">
      {reviews.length > 1 || model.page ? (
        <nav className="deep-review-history" aria-label="Saved deep reviews">
          {reviews.map((report) => {
            const selected = model.detail?.report.id === report.id;
            return (
              <Button
                key={report.id}
                size="sm"
                variant={selected ? 'outline' : 'ghost'}
                aria-pressed={selected}
                onClick={() => model.select(report.id)}
              >
                {new Date(report.createdAt).toLocaleDateString()} ·{' '}
                {report.status.replaceAll('_', ' ')}
              </Button>
            );
          })}
        </nav>
      ) : null}
      {model.detail ? (
        <ReviewReport
          currentReviewRunId={card.packetReview?.runId}
          detail={model.detail}
          childPage={model.childPage}
          changeChildPage={model.changeChildPage}
        />
      ) : (
        <output className="quiet">Opening report…</output>
      )}
      {model.page || nextOffset !== null ? (
        <nav className="flex gap-1" aria-label="Deep review pages">
          <Button
            variant="ghost"
            size="sm"
            disabled={!model.page}
            onClick={() => model.changePage(Math.max(0, model.page - 10))}
          >
            Previous reviews
          </Button>
          <Button
            variant="ghost"
            size="sm"
            disabled={nextOffset === null}
            onClick={() => {
              if (nextOffset !== null) model.changePage(nextOffset);
            }}
          >
            Next reviews
          </Button>
        </nav>
      ) : null}
    </div>
  );
};
