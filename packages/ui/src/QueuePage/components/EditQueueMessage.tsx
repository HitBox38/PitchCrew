import { useState } from 'react';
import type { ChatRequest } from '@pitchcrew/core';
import { chatTokens } from '@pitchcrew/core/chat-references';
import { Button } from '@/components/ui/button/index.tsx';
import { Textarea } from '@/components/ui/textarea/index.tsx';
import { useWorkspaceStore } from '@/WorkspaceStore/index.ts';

export const EditQueueMessage = ({
  request,
  close,
}: {
  request: ChatRequest;
  close: () => void;
}) => {
  const [content, setContent] = useState(request.content);
  const [error, setError] = useState('');
  const action = useWorkspaceStore((s) => s.action);
  const working = useWorkspaceStore((s) => s.working);
  const save = async () => {
    try {
      const previous = [...(request.references ?? [])];
      const references = chatTokens(content).flatMap((token) => {
        const index = previous.findIndex(
          (ref) => ref.token === content.slice(token.start, token.end),
        );
        if (index < 0) return [];
        const [reference] = previous.splice(index, 1);
        return [{ ...reference, start: token.start, end: token.end }];
      });
      await action(
        `/chat-requests/${request.id}`,
        'PUT',
        { action: 'edit', content, references },
        'Queued message updated',
      );
      close();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save message.');
    }
  };
  return (
    <div className="grid gap-2">
      <Textarea
        aria-label="Edit queued message"
        value={content}
        onChange={(e) => setContent(e.target.value)}
        rows={3}
        maxLength={8000}
      />
      {error ? <p role="alert">{error}</p> : null}
      <div className="flex gap-2">
        <Button disabled={working || !content.trim()} onClick={() => void save()}>
          Save message
        </Button>
        <Button onClick={close}>Cancel</Button>
      </div>
    </div>
  );
};
