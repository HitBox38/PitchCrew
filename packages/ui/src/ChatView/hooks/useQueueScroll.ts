import { useEffect, useRef, useState } from 'react';

export const useQueueScroll = () => {
  const viewport = useRef<HTMLElement>(null);
  const [more, setMore] = useState({ above: false, below: false });
  useEffect(() => {
    const element = viewport.current;
    if (!element) return;
    const measure = () => {
      const above = element.scrollTop > 1;
      const below = element.scrollHeight > element.clientHeight + element.scrollTop + 1;
      setMore((current) =>
        current.above === above && current.below === below ? current : { above, below },
      );
    };
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    if (element.firstElementChild) observer.observe(element.firstElementChild);
    element.addEventListener('scroll', measure, { passive: true });
    measure();
    return () => {
      observer.disconnect();
      element.removeEventListener('scroll', measure);
    };
  }, []);
  return { viewport, more };
};
