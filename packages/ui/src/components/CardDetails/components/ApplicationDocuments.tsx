import type { CardDetailsModel } from '../types.ts';
import { Button } from '@pitchcrew/design-system/button';
import { JobPacket } from './JobPacket.tsx';

export const ApplicationDocuments = ({ model }: { model: CardDetailsModel }) => {
  const { card } = model;
  return (
    <div className="space-y-3">
      <Button variant="ghost" size="sm" className="-ml-3 flex w-fit" onClick={model.openWriting}>
        Writing guide
      </Button>
      {/* Without a packet the row's status says Not drafted and the dock offers the draft. */}
      {card.packet ? <JobPacket {...model} /> : null}
    </div>
  );
};
