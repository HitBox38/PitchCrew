import { describe, expect, it } from 'vitest';
import { seenTracker } from '../hooks/useHomeSeen.ts';

/** A tracker over a hand-moved "is Home visible and focused", counting the marks it writes. */
const track = (here: boolean) => {
  const state = { here, marks: 0 };
  const tracker = seenTracker(
    () => state.here,
    () => void (state.marks += 1),
  );
  return { state, ...tracker };
};

describe('Since you were last here: the mark', () => {
  it('moves while Home is in front, then once when the user leaves, never after', () => {
    const home = track(true);
    home.look();
    expect(home.state.marks).toBe(1);
    // Blur: the user leaves for another app, and the mark records when.
    home.state.here = false;
    home.leave();
    expect(home.state.marks).toBe(2);
    // Later the unfocused window is hidden, unloaded and unmounted: none of it moves the mark.
    home.leave();
    home.leave();
    home.look();
    home.leave();
    expect(home.state.marks).toBe(2);
    // Back in front, it follows the user again.
    home.state.here = true;
    home.look();
    home.state.here = false;
    home.leave();
    expect(home.state.marks).toBe(4);
  });

  it('never moves for a Home mounted hidden or unfocused until the user looks at it', () => {
    const hidden = track(false);
    hidden.look();
    hidden.leave();
    hidden.leave();
    expect(hidden.state.marks).toBe(0);
    hidden.state.here = true;
    hidden.look();
    expect(hidden.state.marks).toBe(1);
  });

  it('stops following a window that lost focus without a blur, keeping its last minute', () => {
    const home = track(true);
    home.look();
    home.state.here = false;
    // The minute tick finds Home no longer in front: it writes nothing, nor does a later unload.
    home.look();
    home.leave();
    expect(home.state.marks).toBe(1);
  });
});
