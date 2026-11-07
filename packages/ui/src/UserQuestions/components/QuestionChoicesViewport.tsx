import { useEffect, useRef, useState, type ReactNode } from 'react';

/** Only the question and choices scroll; answer text and decisions stay outside this viewport. */
export const QuestionChoicesViewport = ({ children }: { children: ReactNode }) => {
  const viewport = useRef<HTMLElement>(null);
  const [scroll, setScroll] = useState({ overflow: false, above: false, below: false });
  useEffect(() => {
    const element = viewport.current;
    if (!element) return;
    const measure = () => {
      const overflow = element.scrollHeight > element.clientHeight + 1;
      const above = element.scrollTop > 1;
      const below = element.scrollTop + element.clientHeight < element.scrollHeight - 1;
      setScroll((current) =>
        current.overflow === overflow && current.above === above && current.below === below
          ? current
          : { overflow, above, below },
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
  return (
    <div className="user-question-scroll">
      <section
        ref={viewport}
        className="user-question-fields"
        aria-label="Question and suggested answers"
        // oxlint-disable-next-line jsx-a11y/no-noninteractive-tabindex -- Keyboard users scroll overflowing question choices.
        tabIndex={scroll.overflow ? 0 : undefined}
        data-more-above={scroll.above || undefined}
        data-more-below={scroll.below || undefined}
        data-overflow={scroll.overflow || undefined}
      >
        <div className="user-question-fields-content">{children}</div>
      </section>
      {scroll.overflow ? (
        <p className="user-question-scroll-hint">
          {scroll.below
            ? 'More below · scroll to see all choices'
            : 'Scroll up to review the question'}
        </p>
      ) : null}
    </div>
  );
};
