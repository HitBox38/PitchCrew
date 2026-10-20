import type { WritingGuide } from '@pitchcrew/core';
import { Button } from '@/components/ui/button/components/Button.tsx';

export function GuideProposals({
  guide,
  change,
  working,
}: {
  guide: WritingGuide;
  change: (data: Record<string, unknown>) => Promise<unknown>;
  working: boolean;
}) {
  const proposals = guide.proposals.filter((p) => p.status === 'pending');
  if (!proposals.length) return null;
  return (
    <section className="space-y-3" aria-label="Proposed writing guide changes">
      <h3>Suggested improvements</h3>
      {proposals.map((p) => (
        <article key={p.id} className="space-y-2 border-b border-border pb-3">
          <p className="font-semibold">{p.text}</p>
          <p>{p.reason}</p>
          <p className="quiet">
            Proposed by {p.roleId}
            {p.revision !== guide.revision ? ' · Guide changed; ask for a fresh proposal' : ''}
          </p>
          <div className="flex gap-2">
            <Button
              disabled={working || p.revision !== guide.revision}
              onClick={() =>
                void change({ action: 'proposal_decision', id: p.id, approved: true }).catch(
                  () => {},
                )
              }
            >
              Apply suggestion
            </Button>
            <Button
              disabled={working}
              onClick={() =>
                void change({ action: 'proposal_decision', id: p.id, approved: false }).catch(
                  () => {},
                )
              }
            >
              Dismiss
            </Button>
          </div>
        </article>
      ))}
    </section>
  );
}
