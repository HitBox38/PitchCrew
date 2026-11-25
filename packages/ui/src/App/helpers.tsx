import type { ReadyWorkspaceProps } from '@/App/types.ts';
import { viewTitles } from '@/AppSidebar/constants.ts';
import type { View } from '@/navigation.ts';
import type { Role, Snapshot } from '@pitchcrew/core';

const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? '' : 's'}`;

/**
 * The one quiet fact beside each page title; pages may replace it with their own. Home and
 * Decisions write their own (Home its count, Decisions its pager or its history), and Pipeline's
 * Open | Closed segment already counts its jobs, so none of them has one here.
 */
const pageFact = (view: View | undefined, data: Snapshot) => {
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

const pageTitle = (view: View | undefined) => (view ? viewTitles[view] : 'Page not found');

export const getWorkspaceModel = (props: ReadyWorkspaceProps) => {
  const { data, view, recentIds, act } = props;
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
    fact: pageFact(view, data),
  };
};
