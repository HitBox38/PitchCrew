import { ExtractionControls } from './ExtractionControls.tsx';
import type { useApplicationBrief } from '../hooks/useApplicationBrief.ts';
import type { Card } from '@pitchcrew/core';

/** Extraction leads while no brief exists; afterwards re-extraction is an advanced option. */
export const BriefActions = ({
  model,
  card,
  dockExtracts = false,
}: {
  model: ReturnType<typeof useApplicationBrief>;
  card: Card;
  /** The dock already offers Extract brief, so the column only chooses the agent. */
  dockExtracts?: boolean;
}) => {
  const first = !model.loaded?.context;
  if (!model.available.length)
    return (
      <p className="quiet">
        {first ? 'Automatic extraction needs an agent. ' : ''}Enable Codex, Claude Code or OpenCode
        in Crew to extract or draft. You can prepare a brief manually.
      </p>
    );
  if (first)
    return (
      <section className="grid gap-2" aria-label="Extract brief from posting">
        {dockExtracts ? null : (
          <p className="quiet">
            Choose which agent reads the posting, or write the brief yourself.
          </p>
        )}
        <ExtractionControls
          model={model}
          card={card}
          label={dockExtracts ? undefined : 'Extract brief'}
        />
      </section>
    );
  // Once a brief exists, extracting again is one of the brief's quiet tools.
  return null;
};
