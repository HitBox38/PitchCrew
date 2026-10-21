import { referenceDetails } from '../helpers.ts';
import type { ChatReference } from '@pitchcrew/core';
import type { ReferenceCatalog } from '../types.ts';
import { ReferenceIcon } from './ReferenceIcon.tsx';
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
  PopoverTitle,
  PopoverDescription,
} from '@/components/ui/popover/index.tsx';
import { Button } from '@/components/ui/button/components/Button.tsx';

export const ReferenceChip = ({
  reference,
  catalog,
}: {
  reference: ChatReference;
  catalog: ReferenceCatalog;
}) => {
  const { type, unavailable, description } = referenceDetails(reference, catalog);
  return (
    <Popover>
      <PopoverTrigger
        render={
          <Button variant="ghost" className={`chat-reference chat-reference-${reference.kind}`} />
        }
        data-unavailable={unavailable || undefined}
        aria-label={`${type}: ${reference.label}${unavailable ? ', unavailable' : ''}`}
        data-reference-token={reference.token}
      >
        <ReferenceIcon kind={reference.kind} />
        <span>{reference.label}</span>
      </PopoverTrigger>
      <PopoverContent className="chat-reference-details">
        <PopoverTitle>
          {type}: {reference.label}
        </PopoverTitle>
        <PopoverDescription>{description}</PopoverDescription>
      </PopoverContent>
    </Popover>
  );
};
