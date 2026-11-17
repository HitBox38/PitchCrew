/** Wheel delta that adds up to one zoom step. */
const stepDelta = 40;
/** A pause this long (ms) ends a pinch, so its leftover never counts towards the next one. */
const gestureGap = 250;

/**
 * Turns trackpad pinch and Ctrl+wheel deltas into zoom steps: 1 in, −1 out, 0 not yet. A pause or
 * a change of direction starts over, so a step always follows the reader's current gesture.
 */
export const createPinch = () => {
  let delta = 0;
  let last = -Infinity;
  return ({ deltaY, timeStamp }: Pick<WheelEvent, 'deltaY' | 'timeStamp'>): -1 | 0 | 1 => {
    if (timeStamp - last > gestureGap || deltaY * delta < 0) delta = 0;
    last = timeStamp;
    delta += deltaY;
    if (Math.abs(delta) < stepDelta) return 0;
    const direction = delta < 0 ? 1 : -1;
    delta = 0;
    return direction;
  };
};
