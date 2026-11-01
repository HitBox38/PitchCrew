'use client';

import { useEffect, useState } from 'react';
import { steps } from '../constants';

/** Which journey step is in the middle of the viewport, so the stage track can fill to it. */
export const useStage = () => {
  const [active, setActive] = useState(0);
  useEffect(() => {
    if (!window.IntersectionObserver) return;
    const visible = new Map<Element, boolean>();
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) visible.set(entry.target, entry.isIntersecting);
        const index = steps.findIndex(
          (step) => visible.get(document.getElementById(`step-${step.id}`)!) === true,
        );
        if (index >= 0) setActive(index);
      },
      { rootMargin: '-45% 0px -45% 0px' },
    );
    for (const step of steps) {
      const element = document.getElementById(`step-${step.id}`);
      if (element) observer.observe(element);
    }
    return () => observer.disconnect();
  }, []);
  return steps[active]!;
};
