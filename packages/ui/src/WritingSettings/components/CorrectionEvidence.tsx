import { useState, useEffect } from 'react';
import type { WritingCorrection } from '@pitchcrew/core';
import { AccordionSection } from '@/components/ui/accordion/index.tsx';
import { SourceBlock } from '@/components/SourceBlock/index.tsx';
import { useWorkspaceStore } from '@/WorkspaceStore/index.ts';
import { Button } from '@/components/ui/button/components/Button.tsx';
import { api } from '@/api.ts';

export const CorrectionEvidence = ({ id }: { id: string }) => {
  const [open, setOpen] = useState(false);
  const [evidence, setEvidence] = useState<WritingCorrection>();
  const [error, setError] = useState('');
  const card = useWorkspaceStore((s) => s.data?.cards.find((c) => c.id === evidence?.cardId));
  const openCard = useWorkspaceStore((s) => s.openCard);
  useEffect(() => {
    if (!open) return;
    const request = new AbortController();
    void api<WritingCorrection>(`/quality/corrections/${id}`, 'GET', undefined, request.signal)
      .then(setEvidence)
      .catch((e) => {
        if (!request.signal.aborted) setError(e.message);
      });
    return () => request.abort();
  }, [id, open]);
  return (
    <AccordionSection heading="Supporting correction" onOpenChange={setOpen}>
      {error ? (
        <p role="alert">{error}</p>
      ) : !evidence ? (
        <p className="quiet">Open to load the correction.</p>
      ) : (
        <div className="space-y-2">
          <p>{evidence.instruction}</p>
          <p className="quiet">
            {card ? (
              <Button variant="link" onClick={() => openCard(card.id)}>
                {card.company}: {card.title}
              </Button>
            ) : (
              'Application correction'
            )}{' '}
            · {new Date(evidence.createdAt).toLocaleDateString()}
          </p>
          {(['resume', 'coverLetter'] as const)
            .filter((source) => evidence.scope === 'all' || evidence.scope === source)
            .map((source) => (
              <div key={source}>
                <SourceBlock
                  label={`${source === 'resume' ? 'Resume' : 'Cover letter'} before correction`}
                  value={evidence.before[source]}
                />
                <SourceBlock
                  label="After correction"
                  value={evidence.after?.[source] ?? 'Correction has not completed.'}
                />
              </div>
            ))}
        </div>
      )}
    </AccordionSection>
  );
};
