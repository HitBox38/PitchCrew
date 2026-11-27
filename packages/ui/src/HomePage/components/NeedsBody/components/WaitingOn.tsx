import type { Snapshot } from '@pitchcrew/core';
import type { AttentionItem } from '@/lib/attention.ts';
import { waitingOn } from '../helpers.ts';

/**
 * What stays stuck until the user acts. A browser request's end is an estimate from the run's
 * start and the run limit, so it says "about"; the tooltip gives the derivation.
 */
export const WaitingOn = ({ item, data }: { item: AttentionItem; data: Snapshot }) => {
  const words = waitingOn(item, data);
  if (!words) return null;
  return (
    <p className="needs-blocks">
      <span>Waiting on this</span> {words.text}
      {words.ends ? (
        <>
          {', '}
          <time dateTime={words.ends.iso} title={words.ends.why}>
            about {words.ends.clock}
          </time>
          .
        </>
      ) : null}
    </p>
  );
};
