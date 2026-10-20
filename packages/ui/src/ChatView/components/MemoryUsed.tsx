import { AccordionSection } from '@/components/ui/accordion/components/AccordionSection.tsx';
import type { ChatMessage, Snapshot } from '@pitchcrew/core';
export const MemoryUsed = ({ message, data }: { message: ChatMessage; data: Snapshot }) => {
  if (!message.memoryIds?.length) return null;
  return (
    <AccordionSection
      className="chat-memory-used"
      heading={
        <>
          Memory used <span>{message.memoryIds.length}</span>
        </>
      }
    >
      {message.memoryIds.map((id) => {
        const note = data.memories?.find((entry) => entry.id === id);
        return (
          <p key={id}>{note && !note.deleted ? note.content : 'This note has been deleted.'}</p>
        );
      })}
    </AccordionSection>
  );
};
