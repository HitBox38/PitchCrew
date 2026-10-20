import { useState } from 'react';
import type { ChatViewModel } from '../types.ts';
import type { Conversation } from '@pitchcrew/core';
export const useConversationEditor = ({
  conversation,
  roleId,
  dialog,
  setDialog,
  action,
  onThread,
}: Pick<
  ChatViewModel,
  'conversation' | 'roleId' | 'dialog' | 'setDialog' | 'action' | 'onThread'
>) => {
  const save = async () => {
    try {
      const result = (await action(
        current ? `/conversations/${current.id}` : '/conversations',
        current ? 'PUT' : 'POST',
        {
          title,
          participants,
          leadId: participants.length === 1 ? participants[0] : leadId,
          cardId: cardId || null,
        },
      )) as Conversation;
      setDialog(null);
      onThread(result.id);
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Could not save the conversation.');
    }
  };

  const current = dialog === 'manage' ? conversation : undefined;
  const [title, setTitle] = useState(current?.title ?? '');
  const [participants, setParticipants] = useState(current?.participants ?? [roleId]);
  const [leadId, setLeadId] = useState(current?.leadId ?? roleId);
  const [cardId, setCardId] = useState(current?.cardId ?? '');
  const [error, setError] = useState('');
  return {
    current,
    title,
    setTitle,
    participants,
    setParticipants,
    leadId,
    setLeadId,
    cardId,
    setCardId,
    error,
    save,
  };
};
