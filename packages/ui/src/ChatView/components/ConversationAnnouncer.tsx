import type { ChatViewModel } from '../types.ts';
import { useState } from 'react';
import { nextConversationAnnouncement } from '../announcement.ts';

/** One live region per conversation; historical turn headings never announce on mount. */
export const ConversationAnnouncer = ({
  running,
  questions,
  data,
  thread,
}: Pick<ChatViewModel, 'running' | 'questions' | 'data' | 'thread'>) => {
  const names = new Map(data.roles.map((role) => [role.id, role.name]));
  const name = (id: string) => names.get(id) ?? id;
  const source = {
    thread,
    running: running.map((run) => ({ id: run.id, name: name(run.roleId) })),
    asking: questions.map((question) => ({ id: question.id, name: name(question.roleId) })),
    runs: data.runs.map((run) => ({ id: run.id, name: name(run.roleId), status: run.status })),
  };
  const [state, setState] = useState(() => nextConversationAnnouncement(undefined, source));
  const next = nextConversationAnnouncement(state, source);
  // Commit only phase changes; commentary and reply-token renders preserve the same announcement.
  if (next !== state) setState(next);
  return (
    <output aria-live="polite" aria-atomic="true" className="sr-only">
      {next.text}
    </output>
  );
};
