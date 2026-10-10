import type { Role } from '@pitchcrew/core';
import { Checkbox } from '@/components/ui/checkbox/index.tsx';
import { RoleAvatar } from '@/components/RoleAvatar/index.tsx';
import { ConversationSelect } from '../ConversationSelect.tsx';
export function ParticipantFields({
  roles,
  participants,
  setParticipants,
  leadId,
  setLeadId,
}: {
  roles: Role[];
  participants: string[];
  setParticipants: (ids: string[]) => void;
  leadId: string;
  setLeadId: (id: string) => void;
}) {
  return (
    <section className="grid gap-3">
      <h3 className="text-sm font-semibold">Participants</h3>
      <div className="chat-participant-picker">
        {roles
          .filter((role) => !role.retiredAt || participants.includes(role.id))
          .map((role) => (
            <label key={role.id} className="chat-participant-choice">
              <Checkbox
                checked={participants.includes(role.id)}
                disabled={!!role.retiredAt}
                aria-label={`Include ${role.name}`}
                onCheckedChange={(checked) => {
                  const next = checked
                    ? [...participants, role.id]
                    : participants.filter((id) => id !== role.id);
                  setParticipants(next);
                  if (!next.includes(leadId)) setLeadId(next[0] ?? '');
                }}
              />
              <RoleAvatar agentRole={role.id} size="small" />
              <span>
                {role.name}
                <small>
                  {role.retiredAt ? 'Retired' : role.enabled ? role.description : 'Paused'}
                </small>
              </span>
            </label>
          ))}
      </div>
      {participants.length > 1 ? (
        <div className="field">
          <label htmlFor="conversation-lead">Lead agent</label>
          <ConversationSelect
            id="conversation-lead"
            label="Lead agent"
            value={leadId}
            items={participants.map((id) => ({
              value: id,
              label: roles.find((role) => role.id === id)?.name ?? id,
            }))}
            onChange={setLeadId}
          />
        </div>
      ) : null}
    </section>
  );
}
