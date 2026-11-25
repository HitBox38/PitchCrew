import type { ChatWorkProps } from '@/ChatWork/types.ts';
import type { Action } from '@/WorkspaceStore/index.ts';
import type { Role } from '@pitchcrew/core';

/**
 * The `act` Crew work's cards decide through (`ProposalFooter` calls `act(path, { approved })`):
 * every decision is a POST through `action`, which shows its own errors.
 */
export const proposalAct = (action: Action) => (path: string, body?: unknown) => {
  void action(path, 'POST', body).catch(() => {});
};

export const getChatWorkModel = (props: ChatWorkProps) => {
  const { data, action } = props;
  const act = proposalAct(action);
  const name = (id: Role['id']) => data.roles.find((item) => item.id === id)?.name ?? id;
  // Round members are shown inside their round card rather than as loose follow-ups.
  return { ...props, tasks: props.tasks.filter((task) => !task.roundId), act, name };
};
