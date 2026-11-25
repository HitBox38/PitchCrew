import { proposalAct } from '@/ChatWork/helpers.ts';
import { ClayRoleProposal } from '@/ChatWork/components/ClayRoleProposal.tsx';
import { ClaySkillProposal } from '@/ChatWork/components/ClaySkillProposal.tsx';
import { roleName } from '@/lib/run-labels.ts';
import { useWorkspaceStore } from '@/WorkspaceStore/index.ts';
import { useDeskTools } from '../../../hooks/useDeskTools.ts';
import type { BodyProps } from '../../../types.ts';

/**
 * The proposal card chat's Crew work shows, flattened into the open row (the row is already the
 * raised surface): the exact change, then its verbs in the desk's order (the approve verb first,
 * at the left, and the note under them). Applying waits while the target agent runs, because the
 * daemon refuses it then. Loaded on first review, since the card renders Markdown.
 */
export const ReviewBody = ({ item, data }: Pick<BodyProps, 'item' | 'data'>) => {
  const { act } = useDeskTools();
  const working = useWorkspaceStore((state) => state.working);
  const decide = proposalAct(act({ item, data }));
  if (item.kind === 'skill-proposal') {
    const proposal = data.skillProposals.find((entry) => entry.id === item.entityId);
    if (!proposal) return null;
    const name = (id: string) => data.roles.find((role) => role.id === id)?.name ?? id;
    return (
      <article
        className="chat-proposal"
        aria-label={`${roleName(data, proposal.roleId)} suggested ${proposal.skill.name}`}
      >
        <ClaySkillProposal
          proposal={proposal}
          name={name}
          working={working}
          act={decide}
          approveFirst
        />
      </article>
    );
  }
  const proposal = data.proposals.find((entry) => entry.id === item.entityId);
  const current = data.roles.find((role) => role.id === proposal?.roleId);
  if (!proposal || !current) return null;
  // Any running run of the target, a review seat included: applying is refused while it runs.
  const active = data.runs.some((run) => run.roleId === current.id && run.status === 'running');
  return (
    <article className="chat-proposal" aria-label={`${current.name} proposed changes`}>
      <ClayRoleProposal
        proposal={proposal}
        current={current}
        sourceName={data.roles.find((role) => role.id === proposal.sourceRoleId)?.name}
        active={active}
        working={working}
        act={decide}
        approveFirst
      />
    </article>
  );
};
