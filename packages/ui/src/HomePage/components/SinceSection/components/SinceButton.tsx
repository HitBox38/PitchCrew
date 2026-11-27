import { ArrowDown } from 'lucide-react';
import type { SinceWindow } from '@/lib/since.ts';
import { sinceButtonWords } from '../helpers.ts';

type SinceButtonProps = { summary: string; range: SinceWindow; onJump: () => void };

/**
 * The first screen says whether anything was recorded, beside the Needs you heading: "Since you
 * were last here: 3 finished · 2 new asks", shortened to "Since 22:20" where it must share the
 * heading's line (a narrow desk). On a phone it takes its own line under the heading and keeps
 * what was recorded: "Since 22:20 · 3 finished · 2 new asks". Its new asks are those that arrived
 * in the window and still wait (one leaves the count once decided); Needs you's own count stays in
 * the title fact and the chip. A button, not an in-page link: it brings the section into view,
 * opens it on a phone and focuses it.
 */
export const SinceButton = ({ summary, range, onJump }: SinceButtonProps) => {
  const words = sinceButtonWords(summary, range);
  return (
    <button type="button" className="home-since-link" onClick={onJump}>
      <span className="home-since-link-long">
        <span className="home-since-link-label">Since you were last here:</span> {words.long}
      </span>
      <span className="home-since-link-short">
        {words.short}
        <span className="home-since-link-counts"> · {words.long}</span>
      </span>
      <ArrowDown size={14} aria-hidden="true" />
    </button>
  );
};
