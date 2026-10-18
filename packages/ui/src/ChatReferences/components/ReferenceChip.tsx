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

export function ReferenceChip({
  reference,
  catalog,
}: {
  reference: ChatReference;
  catalog: ReferenceCatalog;
}) {
  const role = catalog.roles.find((role) => role.id === reference.id);
  const skill = catalog.skills.find((skill) => skill.id === reference.id && !skill.deletedAt);
  const unavailable =
    reference.kind === 'agent' ? !role || !!role.retiredAt : reference.kind === 'skill' && !skill;
  const changed = reference.kind === 'skill' && skill && reference.revision !== skill.updatedAt;
  const type =
    reference.kind === 'agent' ? 'Agent' : reference.kind === 'skill' ? 'Skill' : 'Action';
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
          {unavailable
            ? 'This saved reference is no longer available. The original message is preserved.'
            : changed
              ? 'This message selected an earlier version of this skill.'
              : reference.kind === 'agent'
                ? 'A participant addressed by this message. Opening this reference does not send a message.'
                : reference.kind === 'skill'
                  ? 'Instructions selected for this message. Actual agent activity is shown separately.'
                  : 'A request for deep resume review. This reference does not indicate completion or approval.'}
        </PopoverDescription>
      </PopoverContent>
    </Popover>
  );
}
