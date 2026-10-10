import { ConversationEditor } from './ConversationEditor.tsx';
import { ConversationRuntime } from './ConversationRuntime.tsx';
import { MemoryNotebook } from './MemoryNotebook.tsx';
import { RoleSettings } from '@/App/constants.ts';
import type { ChatViewModel } from '../types.ts';
import { useNavigate } from '@tanstack/react-router';
import { Suspense } from 'react';

export function ChatSettingsPanels(props: ChatViewModel) {
  const navigate = useNavigate();
  const role = props.data.roles.find((agent) => agent.id === props.settingsRoleId);
  return (
    <>
      {props.dialog === 'new' || props.dialog === 'manage' ? (
        <ConversationEditor key={`${props.dialog}:${props.thread}`} {...props} />
      ) : null}
      {props.dialog === 'runtime' ? (
        <ConversationRuntime key={`${props.thread}:${props.roleId}`} {...props} />
      ) : null}
      {props.dialog === 'memory' ? <MemoryNotebook key={props.thread} {...props} /> : null}
      {props.dialog === 'defaults' && role ? (
        <Suspense fallback={null}>
          <RoleSettings
            key={role.id}
            docked
            role={role}
            data={props.data}
            action={props.action}
            working={props.working}
            onClose={props.closePanel}
            registerLeaveGuard={props.registerLeaveGuard}
            onManageSkills={() => {
              void navigate({ to: '/skills', search: { filter: role.id } });
            }}
          />
        </Suspense>
      ) : null}
    </>
  );
}
