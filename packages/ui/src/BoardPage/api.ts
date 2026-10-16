import type { Action } from '../WorkspaceStore/types.ts';
import type { CardState } from '@pitchcrew/core';
import { stateLabels } from '../lib/labels.ts';

export const saveJobStatus = (action: Action, id: string, state: CardState) =>
  action(`/cards/${id}/status`, 'POST', { state }, `Moved to ${stateLabels[state]}`);

export const removeJob = (action: Action, id: string) =>
  action(`/cards/${id}`, 'DELETE', undefined, 'Job deleted');

export const startJobWork = (action: Action, id: string, roleId: string, draft: boolean) =>
  action(`/cards/${id}/${draft ? 'draft' : 'run'}`, 'POST', { roleId }, 'Crew work started');

export const cancelJobRun = (action: Action, id: string) =>
  action(`/runs/${id}/cancel`, 'POST', undefined, 'Run cancellation requested');
