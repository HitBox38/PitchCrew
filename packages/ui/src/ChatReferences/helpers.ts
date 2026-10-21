import type { ChatReference } from '@pitchcrew/core';
import type { ReferenceCatalog } from './types.ts';

const descriptions = {
  agent: 'A participant addressed by this message. Opening this reference does not send a message.',
  skill: 'Instructions selected for this message. Actual agent activity is shown separately.',
  action:
    'A request for deep resume review. This reference does not indicate completion or approval.',
};
const types = { agent: 'Agent', skill: 'Skill', action: 'Action' };
export const referenceDetails = (reference: ChatReference, catalog: ReferenceCatalog) => {
  const role = catalog.roles.find((role) => role.id === reference.id);
  const skill = catalog.skills.find((skill) => skill.id === reference.id && !skill.deletedAt);
  const unavailable =
    reference.kind === 'agent' ? !role || !!role.retiredAt : reference.kind === 'skill' && !skill;
  let description = descriptions[reference.kind];
  if (unavailable)
    description = 'This saved reference is no longer available. The original message is preserved.';
  else if (reference.kind === 'skill' && skill && reference.revision !== skill.updatedAt)
    description = 'This message selected an earlier version of this skill.';
  return { type: types[reference.kind], unavailable, description };
};
