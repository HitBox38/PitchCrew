import type { Snapshot } from '@pitchcrew/core';
import { workflowSeat } from '@pitchcrew/core/states';

export function setupProgress(data: Snapshot) {
  const readySeats = new Set(
    data.roles
      .filter(
        (role) =>
          !role.retiredAt &&
          role.enabled &&
          data.runtimes.some((runtime) => runtime.id === role.runtime && runtime.available),
      )
      .map(workflowSeat),
  );
  return {
    profile: data.profile.some((file) => file.content.trim().length > 0),
    crew: ['scout', 'writer', 'reviewer'].every((seat) =>
      readySeats.has(seat as 'scout' | 'writer' | 'reviewer'),
    ),
    job: data.cards.some((card) => !card.sample),
  };
}
