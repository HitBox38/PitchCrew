import type { ReadyWorkspaceProps } from '@/App/types.ts';
import { closedStates, stages } from '@/board-stages.ts';
import { getRoleStatus } from '@/lib/role-status.ts';
import type { Role } from '@pitchcrew/core';

export function getWorkspaceModel(props: ReadyWorkspaceProps) {
  const { data, recentIds, act, view, pending } = props;
  const active = data.cards.filter((c) => !closedStates.includes(c.state));
  const strong = data.cards.filter((c) => c.fit !== null && c.fit >= 80).length;
  const running = data.runs.filter((r) => r.status === 'running');
  const roleStatus = (role: Role) => getRoleStatus(role, data);
  const summary =
    view === 'board' ? (
      data.cards.length ? (
        <>
          <strong>{active.length}</strong> active, <strong>{strong}</strong> with a strong fit
          {pending ? (
            <>
              , <strong>{pending}</strong> waiting on your approval
            </>
          ) : null}
          .
        </>
      ) : (
        'Nothing on the board yet.'
      )
    ) : view === 'crew' ? (
      'Configure how each role works, then start a conversation or a job workflow.'
    ) : view === 'chat' ? (
      'Talk with a role, follow crew exchanges, and shape how your agents work.'
    ) : view === 'inbox' ? (
      pending ? (
        <>
          <strong>{pending}</strong> {pending === 1 ? 'approval is' : 'approvals are'} waiting on
          you.
        </>
      ) : (
        'Nothing is waiting on you.'
      )
    ) : view === 'skills' ? (
      'Give the whole crew shared skills, or tailor them to individual agents.'
    ) : view === 'profile' ? (
      'Writer only quotes from these notes, and Reviewer checks every claim against them.'
    ) : view === 'routines' ? (
      'Give your agents a task and a time. Run it once, or keep a routine.'
    ) : view === 'activity' ? (
      'A history of your jobs, crew runs, and decisions, newest first.'
    ) : view === 'settings' ? (
      'Make Pitchcrew yours. Manage preferences, accounts and this device.'
    ) : (
      'Check the address or return to Board.'
    );
  const stageLinks = stages.map((stage) => ({
    id: stage.id,
    label: stage.label,
    color: stage.color,
    count: data.cards.filter((c) => stage.states.includes(c.state)).length,
  }));
  const recentCards = recentIds
    .map((id) => data.cards.find((card) => card.id === id))
    .filter((card) => card !== undefined);
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
  return { ...props, active, running, roleStatus, summary, stageLinks, recentCards, toggleRole };
}
