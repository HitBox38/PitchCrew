import { useEffect, useState } from 'react';
import type { ReviewPerspective } from '@pitchcrew/core/deep-review-labels';
import { workflowSeat } from '@pitchcrew/core/states';
import { loadReviewSupport } from '../api.ts';
import type { ReviewAlternativeRow, ReviewLaunchProps, ReviewSupport } from '../types.ts';
export const useReviewSetup = ({
  card,
  data,
  act,
  close,
}: ReviewLaunchProps & { close: () => void }) => {
  const reviewer = data.roles.find(
    (role) => role.enabled && !role.retiredAt && workflowSeat(role) === 'reviewer',
  );
  const writer = data.roles.find(
    (role) => role.enabled && !role.retiredAt && workflowSeat(role) === 'writer',
  );
  const [runtimes, setRuntimes] = useState<ReviewSupport[]>([]);
  const [alternatives, setAlternatives] = useState<ReviewAlternativeRow[]>([]);
  const [secondOpinions, setSecondOpinions] = useState(false);
  const [requestedPerspectives, setRequestedPerspectives] = useState<ReviewPerspective[]>([]);
  const [error, setError] = useState('');
  useEffect(() => {
    const controller = new AbortController();
    void loadReviewSupport(controller.signal)
      .then((value) => setRuntimes(value.runtimes))
      .catch((e: Error) => {
        if (!controller.signal.aborted) setError(e.message);
      });
    return () => controller.abort();
  }, []);
  const confirmed = !!card.applicationContext?.confirmedAt;
  const available = [reviewer, writer].every(
    (role) =>
      role &&
      runtimes.some(
        (runtime) =>
          runtime.id === role.runtime && runtime.available && runtime.applicationIsolation,
      ),
  );
  const start = () => {
    if (!reviewer || !writer || !confirmed || !available) return;
    act(
      '/queue/actions',
      {
        cardId: card.id,
        action: 'deep-review',
        roleId: reviewer.id,
        deepReviewOptions: {
          reviewerId: reviewer.id,
          writerId: writer.id,
          secondOpinions,
          requestedPerspectives: secondOpinions ? requestedPerspectives : [],
          alternatives: alternatives.map(({ id: _id, ...value }) => value),
        },
      },
      'Deep resume review queued',
    );
    close();
  };
  return {
    reviewer,
    writer,
    runtimes,
    alternatives,
    setAlternatives,
    secondOpinions,
    setSecondOpinions,
    requestedPerspectives,
    setRequestedPerspectives,
    error,
    confirmed,
    available,
    start,
  };
};
