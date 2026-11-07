import type { ReactNode } from 'react';
import { useQueueScroll } from '../hooks/useQueueScroll.ts';

export const QueueContents = ({ children }: { children: ReactNode }) => {
  const { viewport, more } = useQueueScroll();
  return (
    <>
      <section
        ref={viewport}
        className="chat-queue-content"
        aria-label="Queued messages"
        // oxlint-disable-next-line jsx-a11y/no-noninteractive-tabindex -- Keyboard users scroll the bounded queue.
        tabIndex={more.above || more.below ? 0 : undefined}
        data-more-above={more.above || undefined}
        data-more-below={more.below || undefined}
      >
        <div>{children}</div>
      </section>
      {more.above || more.below ? <p className="chat-queue-scroll-hint">Scroll for more</p> : null}
    </>
  );
};
