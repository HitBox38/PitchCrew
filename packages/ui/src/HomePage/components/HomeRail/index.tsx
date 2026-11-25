import { useCallback } from 'react';
import { useScrollEdges } from '@/hooks/useScrollEdges.ts';
import { HomeSection } from '../HomeSection.tsx';
import { CrewLine } from './components/CrewLine.tsx';
import { PipelineCounts } from './components/PipelineCounts.tsx';
import { UpNext } from './components/UpNext.tsx';
import { WorkingNow } from './components/WorkingNow.tsx';
import { crewFact } from './helpers.ts';
import { useRailEnd } from './hooks/useRailEnd.ts';
import type { HomeLinks, RailModel } from './types.ts';

type HomeRailProps = { rail: RailModel; now: number; links: HomeLinks };

/**
 * The crew's live work beside the desk: flat paper, not a tray, so it stays in view without
 * becoming the subject. Pinned beside the desk it scrolls on its own and shades an edge while more
 * lies past it (in its borders, never over text); under the desk its blocks sit in two columns; on
 * a phone they are two closed sections. A section, not an aside: pages render inside `main`.
 */
export const HomeRail = ({ rail: model, now, links }: HomeRailProps) => {
  const { ref, above, below } = useScrollEdges<HTMLElement>();
  const end = useRailEnd();
  const rail = useCallback(
    (node: HTMLElement | null) => {
      ref(node);
      end(node);
    },
    [ref, end],
  );
  return (
    <section
      ref={rail}
      className="home-rail"
      aria-label="Crew at work"
      data-more-above={above ? '' : undefined}
      data-more-below={below ? '' : undefined}
    >
      <HomeSection title="Crew at work" fact={crewFact(model)} className="home-crew-section">
        <WorkingNow rail={model} now={now} links={links} />
        <UpNext rail={model} links={links} />
        <CrewLine crew={model.crew} />
      </HomeSection>
      <HomeSection
        title="Pipeline"
        fact={`${model.pipeline.open} open`}
        className="home-pipeline-section"
      >
        <PipelineCounts pipeline={model.pipeline} />
      </HomeSection>
    </section>
  );
};
