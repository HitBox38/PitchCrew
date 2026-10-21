import type { Snapshot, Role, UserInputRequest } from '@pitchcrew/core';

export const chatRole = (data: Snapshot, thread: string, recipient: string) => {
  const conversation = data.conversations?.find((item) => item.id === thread);
  const participants = conversation?.participants ?? [thread];
  const roleId = participants.includes(recipient)
    ? recipient
    : (conversation?.leadId ?? participants[0] ?? data.roles[0].id);
  const savedRole = data.roles.find((item) => item.id === roleId) ?? data.roles[0];
  const role = { ...savedRole, ...conversation?.configurations[roleId] };
  return { conversation, participants, roleId, role };
};
export const chatRoleState = (
  data: Snapshot,
  role: Role,
  questions: UserInputRequest[],
  busy: boolean,
) => {
  const roleState = role.retiredAt
    ? 'Retired'
    : !role.enabled
      ? 'Paused'
      : !data.runtimes.some((runtime) => runtime.id === role.runtime && runtime.available)
        ? 'Unavailable'
        : questions.some((question) => question.roleId === role.id)
          ? 'Waiting for you'
          : busy
            ? 'Working'
            : 'Ready';
  return roleState;
};
