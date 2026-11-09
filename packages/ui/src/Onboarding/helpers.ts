import type { Snapshot } from '@pitchcrew/core';
import { workflowSeat } from '@pitchcrew/core/states';

const seats = ['scout', 'writer', 'reviewer'] as const;
const seatNames = { scout: 'Scout', writer: 'Writer', reviewer: 'Reviewer' } as const;

const readySeats = (data: Snapshot, scripted = true) =>
  new Set(
    data.roles
      .filter(
        (role) =>
          !role.retiredAt &&
          role.enabled &&
          (scripted || role.runtime !== 'demo') &&
          data.runtimes.some((runtime) => runtime.id === role.runtime && runtime.available),
      )
      .map(workflowSeat),
  );

export const setupProgress = (data: Snapshot) => {
  const ready = readySeats(data);
  return {
    profile: data.profile.some((file) => file.content.trim().length > 0),
    crew: seats.every((seat) => ready.has(seat)),
    job: data.cards.some((card) => !card.sample),
  };
};

/** Workflow seats without an enabled agent on an installed runtime, by seat name. */
export const missingSeats = (data: Snapshot) => {
  const ready = readySeats(data);
  return seats.filter((seat) => !ready.has(seat)).map((seat) => seatNames[seat]);
};

/** Ready seats whose only ready agents run the scripted Demo runtime (development only). */
export const scriptedSeats = (data: Snapshot) => {
  const ready = readySeats(data);
  const real = readySeats(data, false);
  return seats.filter((seat) => ready.has(seat) && !real.has(seat)).map((seat) => seatNames[seat]);
};
