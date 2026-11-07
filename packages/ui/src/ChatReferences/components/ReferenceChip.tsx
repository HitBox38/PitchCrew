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
  PopoverClose,
} from '@pitchcrew/design-system/popover';
import { Button } from '@pitchcrew/design-system/button';
import { useWorkspaceStore } from '@/WorkspaceStore/index.ts';

export const ReferenceChip = ({
  reference,
  catalog,
  mention = false,
}: {
  reference: ChatReference;
  catalog: ReferenceCatalog;
  mention?: boolean;
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
        <PopoverDescription>
          {mention && !unavailable
            ? 'An agent mentioned in this reply. Their activity appears in this turn’s activity log.'
            : description}
        </PopoverDescription>
        {mention && reference.kind === 'agent' && !unavailable ? (
          <PopoverClose
            render={<Button variant="outline" size="sm" />}
            onClick={() => useWorkspaceStore.getState().setRoleId(reference.id)}
          >
            Agent settings
          </PopoverClose>
        ) : null}
      </PopoverContent>
    </Popover>
  );
};
