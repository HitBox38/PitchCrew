import { useWorkspaceStore } from '@/WorkspaceStore/index.ts';
import type { Card } from '@pitchcrew/core';
import { lessonLimits } from '@pitchcrew/core/insights';
import { useState } from 'react';

export function useLessonDraft(card: Card) {
  const action = useWorkspaceStore((state) => state.action);
  const working = useWorkspaceStore((state) => state.working);
  const [text, setText] = useState('');
  const lessons = card.lessons ?? [];
  const full = lessons.length >= lessonLimits.count;
  const add = async () => {
    try {
      await action(`/cards/${card.id}/lessons`, 'POST', { text }, 'Lesson saved');
      setText('');
    } catch {
      /* The store shows the error and keeps the draft. */
    }
  };
  const remove = (id: string) => {
    void action(`/cards/${card.id}/lessons/${id}`, 'DELETE', undefined, 'Lesson removed').catch(
      () => {},
    );
  };
  return {
    text,
    setText,
    lessons,
    full,
    working,
    canAdd: !working && !full && text.trim().length > 0,
    add,
    remove,
  };
}
