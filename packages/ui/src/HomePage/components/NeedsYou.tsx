import type { ReactNode, RefObject } from 'react';
import type { Snapshot } from '@pitchcrew/core';
import { Accordion } from '@pitchcrew/design-system/accordion';
import { QuestionRecoveries } from '@/Decisions/components/QuestionRecoveries.tsx';
import type { AttentionItem } from '@/lib/attention.ts';
import type { Desk } from '../hooks/useDesk.ts';
import { DeskToolsContext } from '../hooks/useDeskTools.ts';
import { DeskEnd } from './DeskEnd.tsx';
import { NeedsTier } from './NeedsTier.tsx';

type NeedsYouProps = {
  desk: Desk;
  /** The desk's element: its keys, click guard and focus rules work inside it. */
  tray: RefObject<HTMLDivElement | null>;
  items: readonly AttentionItem[];
  data: Snapshot;
  now: number;
  /** The heading's link down to Since you were last here. */
  since?: ReactNode;
};

/**
 * Every attention item in one recessed tray, ranked and grouped by why it ranks where it does, the
 * top one open. Decisions made here close into record lines where their rows stood, and the live
 * region says each once. The chip repeats the title fact's count for the eye; the title fact
 * already says it. The desk's keys and its click guard are bound to the desk, never the window.
 */
export const NeedsYou = ({ desk, tray, items, data, now, since }: NeedsYouProps) => {
  const waiting = desk.entries.some((entry) => entry.type === 'live');
  const decided = desk.entries.some((entry) => entry.type === 'record');
  return (
    <section className="needs" aria-labelledby="needs-title">
      <header className="needs-head">
        <h2 id="needs-title" className="needs-heading">
          Needs you
        </h2>
        {items.length ? (
          <span className="needs-count" aria-hidden="true">
            {items.length}
          </span>
        ) : null}
        {since}
      </header>
      <QuestionRecoveries questions={data.userInputs} />
      <DeskToolsContext value={desk.tools}>
        <div ref={tray} className="needs-tray">
          {desk.sections.length ? (
            <Accordion
              className="needs-rows"
              value={desk.desk.openKey ? [desk.desk.openKey] : []}
              onValueChange={(value) => desk.open((value[0] as string | undefined) ?? null)}
              onKeyDown={desk.keys}
            >
              {desk.sections.map((section) => (
                <NeedsTier
                  key={section.tier}
                  section={section}
                  desk={desk.desk}
                  data={data}
                  now={now}
                  fresh={desk.fresh}
                  fold={desk.fold}
                />
              ))}
            </Accordion>
          ) : null}
          {waiting ? null : <DeskEnd data={data} now={now} decided={decided} />}
        </div>
      </DeskToolsContext>
      <p className="sr-only" aria-live="polite">
        {desk.said}
      </p>
    </section>
  );
};
