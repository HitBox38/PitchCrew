import type { ReadyWorkspaceProps } from '@/App/types.ts';
import { viewTitles } from '@/AppSidebar/constants.ts';
import { closedStateSet } from '@/board-stages.ts';
import type { View } from '@/navigation.ts';
import type { Role, Snapshot } from '@pitchcrew/core';

const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? '' : 's'}`;

/** The one quiet fact beside each page title; pages may replace it with their own. */
export const pageFact = (view: View | undefined, data: Snapshot, pending: number) => {
  if (view === 'board') {
    const active = data.cards.filter((card) => !closedStateSet.has(card.state)).length;
    return data.cards.length ? `${active} active` : '';
  }
  if (view === 'inbox') return pending ? `${pending} waiting` : '';
  if (view === 'crew') {
    const roles = data.roles.filter((role) => !role.retiredAt);
    const working = new Set(
      data.runs.filter((run) => run.status === 'running').map((run) => run.roleId),
    ).size;
    return `${plural(roles.length, 'agent')}${working ? `, ${working} working` : ''}`;
  }
  if (view === 'queue' && data.queue)
    return `${data.queue.active} of ${data.queue.concurrency} slots`;
  if (view === 'skills') return plural(data.skills.length, 'skill');
  if (view === 'routines') return `${data.routines.filter((r) => r.enabled).length} active`;
  return '';
};

export const pageTitle = (view: View | undefined) => (view ? viewTitles[view] : 'Page not found');

export const getWorkspaceModel = (props: ReadyWorkspaceProps) => {
  const { data, view, pending, recentIds, act } = props;
  const running = data.runs.filter((r) => r.status === 'running');
  const recentCards = recentIds
    .map((id) => data.cards.find((card) => card.id === id))
    .filter((card) => card !== undefined);
  /** Pause or resume a role, the same settings write the role panel makes. */
  const toggleRole = (role: Role) =>
    act(
      `/roles/${role.id}`,
      'PUT',
      {
        runtime: role.runtime,
        model: role.model,
        enabled: !role.enabled,
        instructions: role.instructions,
        capabilities: role.capabilities,
      },
      `${role.name} ${role.enabled ? 'paused' : 'resumed'}`,
    );
  return {
    ...props,
    running,
    recentCards,
    toggleRole,
    title: pageTitle(view),
    fact: pageFact(view, data, pending),
  };
};
