import { requireRole } from './roles.ts';
import {
  defaultCapabilities,
  workflowSeat,
  runResultSchema,
  type Approval,
  type Card,
  type Role,
} from '@pitchcrew/core';
import { lintPacket, readProfile } from '@pitchcrew/packet';
import { z } from 'zod';
import { computerAction } from './gateway/computer.ts';
import { connectorAccess, connectorAction } from './gateway/connectors.ts';
import { notifyUser, queueMessage, readMessages } from './gateway/messages.ts';
import { proposeRole, proposeSkill } from './gateway/proposals.ts';
import { changeWorkflow } from './gateway/workflow.ts';
import { profileAction } from './gateway/profile.ts';
import { routineAction } from './gateway/routines.ts';
import { trackingAction } from './gateway/tracking.ts';
import type { CrewContext } from './types.ts';

export async function agentCall(
  this: CrewContext,
  token: string,
  action: string,
  data: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const capability = this.capabilities.get(token);
  if (!capability || this.controllers.get(capability.runId)?.signal.aborted)
    throw new Error('Run capability is invalid or expired.');
  const role = requireRole(this, capability.roleId);
  if (!role.enabled) throw new Error('This role is paused.');
  const permissions = role.capabilities ?? defaultCapabilities;
  if (['applications', 'tracking_scan', 'tracking_reconcile'].includes(action))
    return trackingAction.call(this, capability, token, action, data);
  if (['routines', 'save_routine', 'delete_routine'].includes(action))
    return routineAction.call(this, capability, action, data);
  if (
    [
      'watched_profile_sources',
      'detect_profile_changes',
      'read_project_watch_file',
      'propose_profile_note',
    ].includes(action)
  )
    return profileAction.call(this, capability, token, action, data);
  if (action === 'computer_access') return { enabled: permissions.computerUse === true };
  if (['computer_inspect', 'computer_request', 'computer_execute'].includes(action))
    return computerAction.call(this, capability, token, action, data);
  if (action === 'connector_access') return connectorAccess.call(this, permissions);
  if (action === 'connector') return connectorAction.call(this, capability, permissions, data);
  if (action === 'notify_user') return notifyUser.call(this, capability, data);
  if (action === 'roles')
    return {
      roles: this.board
        .list<Role>('role')
        .filter((item) => !item.retiredAt)
        .map((item) => ({
          id: item.id,
          name: item.name,
          description: item.description,
          enabled: item.enabled,
          workflow: workflowSeat(item),
        })),
    };
  if (action === 'messages') return readMessages.call(this, capability);
  if (action === 'message' || action === 'invoke')
    return queueMessage.call(this, capability, permissions, action, data);
  if (action === 'propose') return proposeRole.call(this, capability, role, data);
  if (action === 'propose_skill') return proposeSkill.call(this, capability, role, token, data);
  if (action === 'workflow') return changeWorkflow.call(this, capability, permissions, data);
  if (['card', 'history', 'export'].includes(action) && !capability.cardId)
    throw new Error('This chat has no attached application.');
  if (action === 'card') return { card: this.board.get<Card>('card', capability.cardId!) };
  if (action === 'profile') return { profile: await readProfile(this.directory) };
  if (action === 'history') {
    const query = z
      .object({
        beforeEventId: z.number().int().positive().optional(),
        limit: z.number().int().min(1).max(200).default(100),
      })
      .parse(data);
    const events = this.board.history(capability.cardId!, query.beforeEventId, query.limit);
    return { events, nextCursor: events.length === query.limit ? events.at(-1)!.id : null };
  }
  if (action === 'lint') {
    const parsed = runResultSchema.parse({ role: 'writer', packet: data.packet });
    if (parsed.role !== 'writer') throw new Error('Invalid packet.');
    return { problems: lintPacket(parsed.packet, await readProfile(this.directory)) };
  }
  if (action === 'export') {
    const approval = this.board.get<Approval>('approval', String(data.approvalId));
    if (approval.cardId !== capability.cardId)
      throw new Error('This run cannot access another application.');
    return { directory: await this.exportPacket(approval.id) };
  }
  throw new Error('This tool is not allowed.');
}
