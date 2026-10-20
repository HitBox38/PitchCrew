import { ReviewSecondOpinions } from './ReviewSecondOpinions.tsx';
import { useReviewSetup } from '../hooks/useReviewSetup.ts';
import type { ReviewLaunchProps } from '../types.ts';
import { ReviewAlternatives } from './ReviewAlternatives.tsx';
import { Modal } from '@/components/Modal/index.tsx';
import { Button } from '@/components/ui/button/components/Button.tsx';
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
      <div className="grid max-h-[70vh] gap-4 overflow-y-auto p-5">
        <ReviewSetupIntro card={card} reviewer={reviewer} writer={writer} />
        <p className="optional">
          Starts with one Reviewer. Targeted subagents may run when useful. The shared budget starts
          at 30 minutes; Reviewer can extend it and explain why. Stop cancels the whole review.
        </p>
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
        <p className="optional">
          Reports and both resume versions stay with this job. Downloads and submission keep their
          existing approval steps.
        </p>
        <Button disabled={working || !confirmed || !available} onClick={start}>
          Start deep review
        </Button>
      </div>
    </Modal>
  );
};
