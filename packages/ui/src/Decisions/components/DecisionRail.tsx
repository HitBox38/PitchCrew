import type { Snapshot } from '@pitchcrew/core';
import { stateLabels } from '@/lib/labels.ts';
import { trackBeads, trackSteps } from '@/ClayInterface/helpers.ts';
import { decisionTitle } from '@/ClayInterface/jobs.ts';
import type { Decision } from '@/ClayInterface/signals.ts';

type DecisionRailProps = {
  decision: Decision;
  items: Decision[];
  data: Snapshot;
  select: (id: string) => void;
};

/** What comes after this decision, and where its job stands in the workflow. */
export const DecisionRail = ({ decision, items, data, select }: DecisionRailProps) => {
  const card = data.cards.find((item) => item.id === decision.cardId);
  const beads = card ? trackBeads(card.state) : [];
  const start = items.findIndex((item) => item.id === decision.id);
  const then = [...items.slice(start + 1), ...items.slice(0, Math.max(start, 0))];
  return (
    <aside className="clay-decide-rail" aria-label="Context">
      {then.length ? (
        <section>
          <h3>Then</h3>
          {then.slice(0, 5).map((item) => (
            <button
              key={item.id}
              type="button"
              className="clay-deck-next"
              onClick={() => select(item.id)}
            >
              <strong>
                {data.cards.find((c) => c.id === item.cardId)?.company ?? 'Conversation'}
              </strong>
              <span>{decisionTitle(item, data)}</span>
            </button>
          ))}
        </section>
      ) : null}
      {card ? (
        <section>
          <h3>{card.company} so far</h3>
          <ol className="clay-decide-steps">
            {trackSteps.map((step, index) => (
              <li key={step.id} data-bead={beads[index]}>
                <span
                  className="clay-bead"
                  data-size={beads[index] === 'current' ? 'lg' : undefined}
                  data-tone={
                    beads[index] === 'done'
                      ? 'done'
                      : beads[index] === 'current'
                        ? 'ochre'
                        : undefined
                  }
                  aria-hidden="true"
                />
                <span>{beads[index] === 'current' ? stateLabels[card.state] : step.label}</span>
              </li>
            ))}
          </ol>
        </section>
      ) : null}
    </aside>
  );
};
