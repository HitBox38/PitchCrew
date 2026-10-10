import { useWorkspaceStore } from '@/WorkspaceStore/index.ts';
import { FormSelect } from '@/FormSelect/index.tsx';
import type { DraftFieldsProps } from '../types.ts';
export function RoutineConversation({ draft, change }: DraftFieldsProps) {
  const conversations = useWorkspaceStore((state) => state.data?.conversations);
  const eligible = (conversations ?? []).filter(
    (item) =>
      !['agent_dm', 'history'].includes(item.kind) &&
      item.participants.includes(draft.roleId) &&
      item.cardId === (draft.cardId || null),
  );
  return (
    <FormSelect
      label="Post results to"
      value={eligible.some((item) => item.id === draft.conversationId) ? draft.conversationId! : ''}
      options={[
        { value: '', label: 'A dedicated conversation for this routine' },
        ...eligible.map((item) => ({ value: item.id, label: item.title })),
      ]}
      onValueChange={(conversationId) => change({ conversationId })}
    />
  );
}
