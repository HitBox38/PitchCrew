import type { ChatMessage, Snapshot } from '@pitchcrew/core';
export function MemoryUsed({ message, data }: { message: ChatMessage; data: Snapshot }) {
  if (!message.memoryIds?.length) return null;
  return (
    <details className="chat-memory-used">
      <summary>
        Memory used <span>{message.memoryIds.length}</span>
      </summary>
      {message.memoryIds.map((id) => {
        const note = data.memories?.find((entry) => entry.id === id);
        return (
          <p key={id}>{note && !note.deleted ? note.content : 'This note has been deleted.'}</p>
        );
      })}
    </details>
  );
}
