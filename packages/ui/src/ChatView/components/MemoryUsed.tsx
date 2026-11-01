import { AccordionSection } from '@/components/ui/accordion/components/AccordionSection.tsx';
import type { ChatMessage, Snapshot } from '@pitchcrew/core';
import { BookOpen } from 'lucide-react';
export const MemoryUsed = ({ message, data }: { message: ChatMessage; data: Snapshot }) => {
  if (!message.memoryIds?.length) return null;
  return (
    <AccordionSection
      className="chat-memory-used"
      heading={
        <>
          <BookOpen size={12} aria-hidden="true" />
          Memory used <span>{message.memoryIds.length}</span>
        </>
      }
    >
      {message.memoryIds.map((id) => {
        const note = data.memories?.find((entry) => entry.id === id);
        return (
          <p key={id} data-deleted={note && !note.deleted ? undefined : ''}>
            {note && !note.deleted ? note.content : 'This note has been deleted.'}
          </p>
        );
      })}
    </AccordionSection>
  );
};
