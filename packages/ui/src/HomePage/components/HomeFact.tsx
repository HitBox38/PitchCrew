import type { Snapshot } from '@pitchcrew/core';
import { WorkspaceHeaderFact } from '@/App/components/WorkspacePage.tsx';
import type { AttentionItem } from '@/lib/attention.ts';
import { factParts } from '../helpers.ts';

type HomeFactProps = { items: readonly AttentionItem[]; data: Snapshot };

/**
 * One status line beside the title: how many things wait on the user (the Home badge's number),
 * how full the work slots are, and in rose how many requests failed, so the broken one is named
 * before any row.
 */
export const HomeFact = ({ items, data }: HomeFactProps) => {
  const { needs, slots, failed } = factParts(items, data);
  return (
    <WorkspaceHeaderFact>
      <span className="home-fact">
        {needs}
        {slots ? ` · ${slots}` : null}
        {failed ? (
          <>
            {' · '}
            <span className="home-fact-failed">{failed}</span>
          </>
        ) : null}
      </span>
    </WorkspaceHeaderFact>
  );
};
