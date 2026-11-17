import { ReviewSecondOpinions } from './ReviewSecondOpinions.tsx';
import { useReviewSetup } from '../hooks/useReviewSetup.ts';
import type { ReviewLaunchProps } from '../types.ts';
import { ReviewAlternatives } from './ReviewAlternatives.tsx';
import { Modal } from '@/components/Modal/index.tsx';
import { Button } from '@pitchcrew/design-system/button';
import { ReviewSetupIntro } from './ReviewSetupIntro.tsx';
export const ReviewSetup = ({
  card,
  data,
  working,
  act,
  close,
}: ReviewLaunchProps & { close: () => void }) => {
  const {
    reviewer,
    writer,
    runtimes,
    alternatives,
    setAlternatives,
    error,
    confirmed,
    available,
    start,
    secondOpinions,
    setSecondOpinions,
    requestedPerspectives,
    setRequestedPerspectives,
  } = useReviewSetup({ card, data, working, act, close });
  return (
    <Modal title="Deep review resume" onClose={close}>
      <div className="deep-review-setup -mx-1 grid max-h-[70vh] gap-5 overflow-y-auto px-1 py-1">
        <ReviewSetupIntro card={card} reviewer={reviewer} writer={writer} />
        <ReviewSecondOpinions
          enabled={secondOpinions}
          changeEnabled={setSecondOpinions}
          selected={requestedPerspectives}
          changeSelected={setRequestedPerspectives}
        />
        <ReviewAlternatives
          runtimes={runtimes}
          alternatives={alternatives}
          setAlternatives={setAlternatives}
          error={error}
        />
        {error ? <p role="alert">{error}</p> : null}
        {!confirmed ? (
          <p role="alert">Confirm this job’s brief in Application before starting.</p>
        ) : null}
        {!available ? (
          <p role="alert">
            Choose available Writer and Reviewer runtimes that support isolated applications in
            Crew.
          </p>
        ) : null}
        <div className="deep-review-setup-footer">
          <p className="quiet">
            Runs up to 30 minutes, which Reviewer can extend with a reason; Stop cancels all of it.
            Reports and both resume versions stay with this job. Nothing is exported or sent.
          </p>
          <Button
            className="justify-self-end"
            disabled={working || !confirmed || !available}
            onClick={start}
          >
            Start deep review
          </Button>
        </div>
      </div>
    </Modal>
  );
};
