import type { Card, Snapshot } from '@pitchcrew/core';
import { useDeepReviews } from './hooks/useDeepReviews.ts';
import { ReviewReport } from './components/ReviewReport.tsx';
import { Button } from '@/components/ui/button/components/Button.tsx';
export const DeepResumeReview = ({ card, data }: { card: Card; data: Snapshot }) => {
  const revision = data.runs
    .filter((run) => run.cardId === card.id && run.deepReviewId)
    .map((run) => `${run.id}:${run.status}:${run.message}`)
    .join('|');
  const model = useDeepReviews(card.id, revision);
  if (model.error)
    return (
      <div role="alert">
        <p>{model.error}</p>
        <Button onClick={model.retry}>Retry deep reviews</Button>
      </div>
    );
  if (!model.list) return <output>Loading deep reviews…</output>;
  return (
    <div className="grid gap-5">
      <header className="space-y-2">
        <h2>Deep resume reviews</h2>
        <p>Seven hiring perspectives, supported corrections and a full packet recheck.</p>
      </header>
      {!model.list.reviews.length ? (
        <p>Start Deep review resume from this job’s actions or ask for it in a conversation.</p>
      ) : (
        <>
          <nav className="flex flex-wrap gap-2" aria-label="Saved deep reviews">
            {model.list.reviews.map((report) => (
              <Button
                key={report.id}
                variant={model.detail?.report.id === report.id ? 'default' : 'outline'}
                onClick={() => model.select(report.id)}
              >
                {new Date(report.createdAt).toLocaleDateString()} ·{' '}
                {report.status.replaceAll('_', ' ')}
              </Button>
            ))}
          </nav>
          {model.detail ? (
            <ReviewReport
              currentReviewRunId={card.packetReview?.runId}
              detail={model.detail}
              childPage={model.childPage}
              changeChildPage={model.changeChildPage}
            />
          ) : (
            <output>Opening report…</output>
          )}
        </>
      )}
      {model.page || model.list.nextOffset !== null ? (
        <nav className="flex gap-2" aria-label="Deep review pages">
          <Button
            disabled={!model.page}
            onClick={() => model.changePage(Math.max(0, model.page - 10))}
          >
            Previous reviews
          </Button>
          <Button
            disabled={model.list.nextOffset === null}
            onClick={() => {
              if (model.list?.nextOffset !== null && model.list?.nextOffset !== undefined)
                model.changePage(model.list.nextOffset);
            }}
          >
            Next reviews
          </Button>
        </nav>
      ) : null}
    </div>
  );
};
