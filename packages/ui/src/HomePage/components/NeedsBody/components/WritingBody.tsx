import { roleName } from '@/lib/run-labels.ts';
import { GuideProposal } from '@/WritingSettings/components/GuideProposal.tsx';
import { guideChange } from '@/WritingSettings/helpers.ts';
import { useWorkspaceStore } from '@/WorkspaceStore/index.ts';
import { useDeskTools } from '../../../hooks/useDeskTools.ts';
import type { BodyProps } from '../../../types.ts';
import { OpenHeader } from './OpenHeader.tsx';

/**
 * A writing guide suggestion, applied or dismissed with the card Settings shows, against the
 * guide revision it was made for (one made against an older guide can only be dismissed).
 */
export const WritingBody = ({ item, data }: BodyProps) => {
  const { act } = useDeskTools();
  const working = useWorkspaceStore((state) => state.working);
  const guide = data.quality?.writingGuide;
  const proposal = guide?.proposals.find((entry) => entry.id === item.entityId);
  if (!guide || !proposal) return null;
  return (
    <>
      <OpenHeader item={item} data={data} />
      <GuideProposal
        proposal={proposal}
        guide={guide}
        roleName={roleName(data, proposal.roleId)}
        change={guideChange(act({ item, data }), guide.revision)}
        working={working}
      />
    </>
  );
};
