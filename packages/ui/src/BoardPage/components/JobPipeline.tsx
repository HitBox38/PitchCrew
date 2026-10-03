import { stages } from '@/board-stages.ts';
import type { JobPipelineProps } from '@/BoardPage/types.ts';
import { JobCard } from '@/components/JobCard/index.tsx';
import { Button } from '@/components/ui/button/components/Button.tsx';
import { Plus } from 'lucide-react';
import { AnimatePresence } from 'motion/react';
import * as m from 'motion/react-m';

export function JobPipeline({ filtered, flashStage, setAdd, openCard, query }: JobPipelineProps) {
  return (
    <m.div
      layoutScroll
      className="pipeline grid grid-cols-[repeat(5,minmax(210px,1fr))] gap-3 overflow-x-auto pb-1.5 max-compact:grid-cols-[repeat(5,236px)]"
      aria-label="Application pipeline"
    >
      {stages.map((stage) => {
        const cards = filtered.filter((c) => stage.states.includes(c.state));
        return (
          <section
            className={`pipeline-column min-h-110 min-w-0 px-2 pt-2.5 pb-3 max-compact:min-h-80 ${stage.color} ${flashStage === stage.id ? 'flash' : ''}`}
            id={`stage-${stage.id}`}
            key={stage.id}
          >
            <div className="column-heading mb-2.5 flex h-6.5 items-center gap-2 px-1.5">
              <span className="stage-dot" />
              <h2>{stage.label}</h2>
              <span className="column-count">{cards.length}</span>
              {stage.id === 'lead' ? (
                <Button className="icon-button" aria-label="Add a job" onClick={() => setAdd(true)}>
                  <Plus size={15} />
                </Button>
              ) : null}
            </div>
            <div className="column-cards flex flex-col gap-2">
              <AnimatePresence initial={false}>
                {cards.map((card) => (
                  <JobCard key={card.id} card={card} onOpen={() => openCard(card.id)} />
                ))}
              </AnimatePresence>
              {!cards.length ? (
                <p className="column-empty">{query ? 'No matches.' : stage.empty}</p>
              ) : null}
            </div>
          </section>
        );
      })}
    </m.div>
  );
}
