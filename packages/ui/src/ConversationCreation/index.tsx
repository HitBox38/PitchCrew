import { ConversationEditor } from '@/ChatView/components/ConversationEditor.tsx';
import { useWorkspaceNavigation } from '@/workspace-navigation.ts';
import { useParams } from '@tanstack/react-router';
import type { Snapshot } from '@pitchcrew/core';
import type { Action } from '@/WorkspaceStore/types.ts';

export function ConversationCreation({
  data,
  action,
  working,
  onClose,
}: {
  data: Snapshot;
  action: Action;
  working: boolean;
  onClose: () => void;
}) {
  const { thread } = useParams({ strict: false });
  const { openChat } = useWorkspaceNavigation();
  const conversation = data.conversations?.find((item) => item.id === thread);
  const preferred = conversation?.leadId ?? thread;
  const roleId =
    data.roles.find((role) => role.id === preferred && !role.retiredAt)?.id ??
    data.roles.find((role) => !role.retiredAt)?.id ??
    data.roles[0].id;
  return (
    <ConversationEditor
      data={data}
      action={action}
      working={working}
      roleId={roleId}
      conversation={undefined}
      dialog="new"
      setDialog={onClose}
      onThread={openChat}
      jobItems={[
        { value: '', label: 'Attach a job' },
        ...data.cards.map((card) => ({ value: card.id, label: `${card.company} · ${card.title}` })),
      ]}
    />
  );
}
