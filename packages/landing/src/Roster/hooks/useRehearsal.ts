'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { schedule } from '../constants';
import type { Phase } from '../types';

const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * Plays the crew's morning once: the server renders the finished state, and a motion-allowed
 * client rewinds to idle and lets CSS transitions carry each phase. Replay restarts it.
 */
export const useRehearsal = () => {
  const [phase, setPhase] = useState<Phase>('done');
  const [playing, setPlaying] = useState(false);
  const timers = useRef<number[]>([]);

  const clear = () => {
    timers.current.forEach((id) => window.clearTimeout(id));
    timers.current = [];
  };

  const play = useCallback(() => {
    clear();
    setPlaying(true);
    for (const { phase: next, at } of schedule) {
      timers.current.push(
        window.setTimeout(() => {
          setPhase(next);
          if (next === 'done') setPlaying(false);
        }, at),
      );
    }
  }, []);

  useEffect(() => {
    if (reduced() || !window.IntersectionObserver) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) return;
        observer.disconnect();
        play();
      },
      { threshold: 0.35 },
    );
    const target = document.getElementById('roster');
    if (target) observer.observe(target);
    return () => {
      observer.disconnect();
      clear();
    };
  }, [play]);

  const replay = () => {
    if (reduced()) return;
    play();
  };

  return { phase, playing, replay };
};
