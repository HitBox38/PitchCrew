import { useEffect, useRef, useState } from 'react';

/**
 * How visible the agent's pointer is, driven by timers rather than CSS animations so it also
 * settles with reduced motion: full for a moment after each move, resting faintly while the run
 * lasts, then fading out after a navigation or once the run ends. A pointer left over from before
 * the overlay mounted stays hidden unless a run is still using the page.
 */
export type AgentCursorPhase = 'full' | 'rest' | 'fading' | 'hidden';

export const cursorSettleDelay = (navigated: boolean) => (navigated ? 350 : 700);

export const useAgentCursorPhase = (
  sequence: number | undefined,
  navigated: boolean,
  working: boolean,
) => {
  const [phase, setPhase] = useState<AgentCursorPhase>(() =>
    sequence !== undefined && working && !navigated ? 'rest' : 'hidden',
  );
  const mountedWith = useRef(sequence);
  const live = useRef({ navigated, working });
  useEffect(() => {
    live.current = { navigated, working };
  });
  // Each new move shows the pointer, then lets it rest or fade.
  useEffect(() => {
    if (sequence === undefined || sequence === mountedWith.current) return;
    mountedWith.current = undefined;
    setPhase('full');
    const settle = setTimeout(() => {
      const now = live.current;
      setPhase(now.working && !now.navigated ? 'rest' : 'fading');
    }, cursorSettleDelay(navigated));
    return () => clearTimeout(settle);
  }, [sequence, navigated]);
  // The run ending fades whatever is left.
  useEffect(() => {
    if (working) return;
    const end = setTimeout(
      () => setPhase((current) => (current === 'hidden' ? current : 'fading')),
      600,
    );
    return () => clearTimeout(end);
  }, [working]);
  useEffect(() => {
    if (phase !== 'fading') return;
    const gone = setTimeout(() => setPhase('hidden'), 300);
    return () => clearTimeout(gone);
  }, [phase]);
  return phase;
};
