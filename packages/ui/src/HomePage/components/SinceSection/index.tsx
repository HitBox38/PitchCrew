import { memo, type RefObject } from 'react';
import { Link } from '@tanstack/react-router';
import {
  sinceEmpty,
  sinceExplainer,
  sinceShown,
  type SinceLine as Line,
  type SinceWindow,
} from '@/lib/since.ts';
import { deepEqual } from '@/lib/share-equal.ts';
import type { HomeLinks } from '../HomeRail/types.ts';
import { HomeSection } from '../HomeSection.tsx';
import { SinceLine } from './components/SinceLine.tsx';
import { sinceDays, sinceWindowTitle } from './helpers.ts';

type SinceSectionProps = {
  lines: Line[];
  range: SinceWindow;
  summary: string;
  now: number;
  links: HomeLinks;
  /** Holds the section, so the heading's since button can bring it into view and focus it. */
  area: RefObject<HTMLDivElement | null>;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

/**
 * What the crew recorded since the user was last here on this device, newest first and grouped by
 * day. Pitchcrew records crew work only while it runs, so the section never claims what happened
 * while it was stopped, and an empty one says what it can: nothing recorded since then. On a phone
 * it is a closed section that the heading's since button opens.
 */
export const SinceSection = memo(
  ({ lines, range, summary, now, links, area, open, onOpenChange }: SinceSectionProps) => {
    const { shown, more } = sinceShown(lines);
    return (
      <div ref={area} className="home-since-area">
        <HomeSection
          title="Since you were last here"
          fact={summary || 'Nothing recorded'}
          open={open}
          onOpenChange={onOpenChange}
          className="home-since-section"
        >
          <section className="home-block home-since" aria-labelledby="home-since-title">
            <header className="home-block-head">
              <h2
                id="home-since-title"
                className="home-heading"
                tabIndex={-1}
                data-since-heading=""
                data-section-title=""
              >
                Since you were last here
              </h2>
              <span className="home-block-fact" title={sinceWindowTitle(range)}>
                {range.label}
              </span>
            </header>
            {shown.length ? (
              sinceDays(shown, now).map((day) => (
                <div key={day.label} className="home-since-day">
                  <h3 className="home-since-label">{day.label}</h3>
                  <ol className="home-since-lines">
                    {day.lines.map((line) => (
                      <SinceLine key={line.id} line={line} links={links} />
                    ))}
                  </ol>
                </div>
              ))
            ) : (
              <p className="home-since-empty">
                <strong>{sinceEmpty(range)}</strong> {sinceExplainer}
              </p>
            )}
            {more ? (
              <Link to="/activity" className="home-since-more">
                {more.text}
              </Link>
            ) : null}
          </section>
        </HomeSection>
      </div>
    );
  },
  deepEqual,
);
