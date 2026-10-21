import type { CardDetailsModel } from '../types.ts';
import { Button } from '@/components/ui/button/components/Button.tsx';
import { JobPacket } from './JobPacket.tsx';

export const ApplicationDocuments = ({ model }: { model: CardDetailsModel }) => {
  const { card, brief } = model;
  return (
    <div className="space-y-3">
      <Button variant="link" onClick={model.openWriting}>
        Writing guide
      </Button>
      {card.packet ? (
        <JobPacket {...model} />
      ) : (
        <p className="quiet">
          {brief.confirmed
            ? 'Use Draft application below to prepare your documents.'
            : 'Review and confirm the brief, then draft your application.'}
        </p>
      )}
    </div>
  );
};
