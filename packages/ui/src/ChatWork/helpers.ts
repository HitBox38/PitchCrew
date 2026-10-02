import type { ChatWorkProps } from '@/ChatWork/types.ts';
import type { Role } from '@pitchcrew/core';

export function getChatWorkModel(props: ChatWorkProps) {
  const { data, action } = props;
  const act = (path: string, body?: unknown) => {
    void action(path, 'POST', body).catch(() => {});
  };
  const name = (id: Role['id']) => data.roles.find((item) => item.id === id)?.name ?? id;
  return { ...props, act, name };
}
