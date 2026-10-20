import { useRef, useState, type MouseEvent } from 'react';
import { useNavigate } from '@tanstack/react-router';
import type { Conversation } from '@pitchcrew/core';
import type { AddOpportunityProps } from '../types.ts';
import { jobLinkAction, scoutJobPrompt, scoutJobTarget } from '../link-actions.ts';

/** An explicit user click sends an ordinary, capability-gated Scout chat request. */
export function useScoutJobImport({ data, action, working, onClose }: AddOpportunityProps) {
  const navigate = useNavigate();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const sending = useRef(false);
  const conversation = useRef<{ roleId: string; id: string } | null>(null);
  const { role, blocker } = scoutJobTarget(data);
  async function askScout(event: MouseEvent<HTMLButtonElement>, fallbackUrl?: string | null) {
    const field = event.currentTarget.form?.elements.namedItem('url');
    if (!(field instanceof HTMLInputElement)) return;
    const mode = jobLinkAction(field.value);
    if (mode === 'invalid' || (mode !== 'scout' && fallbackUrl !== field.value.trim())) return;
    if (working || sending.current || !role) return;
    const url = field.value.trim();
    sending.current = true;
    setPending(true);
    setError('');
    try {
      if (conversation.current?.roleId !== role.id) {
        const created = (await action('/conversations', 'POST', {
          title: 'Add job from link',
          participants: [role.id],
        })) as Conversation;
        conversation.current = { roleId: role.id, id: created.id };
      }
      const thread = conversation.current.id;
      await action(`/conversations/${thread}/messages`, 'POST', {
        content: scoutJobPrompt(url),
        intent: 'queue',
      });
      onClose();
      void navigate({ to: '/chat/$thread', params: { thread } });
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Could not ask Scout to add the job.');
    } finally {
      sending.current = false;
      setPending(false);
    }
  }
  return { pending, error, blocker, askScout };
}
