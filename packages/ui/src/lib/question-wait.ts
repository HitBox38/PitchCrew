import type { Snapshot } from '@pitchcrew/core';

/**
 * The user already answered this run's question. A waiting run with an answered question has
 * handed the turn back and stays waiting only until its queued continuation settles, so it no
 * longer waits on the user.
 */
export const questionAnswered = (runId: string, userInputs: Snapshot['userInputs']) =>
  !!userInputs?.some((question) => question.runId === runId && question.status === 'answered');
