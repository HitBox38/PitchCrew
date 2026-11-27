import type { ReactNode } from 'react';
import type { Snapshot } from '@pitchcrew/core';
import { RoleAvatar } from '@/components/RoleAvatar/index.tsx';
import type { AttentionItem } from '@/lib/attention.ts';
import { openRowWords } from '../helpers.ts';

type OpenHeaderProps = {
  item: AttentionItem;
  data: Snapshot;
  /** The row's evidence, said between the ask and who asked. */
  children?: ReactNode;
};

/**
 * The open row's first lines, in the one order every kind keeps: the exact ask as its headline (a
 * question's own words), its evidence, then who asked and when, beside the avatar of the agent
 * that acted ("Reviewer agreed" carries Reviewer's). "Waiting on this", the verbs with the glazed
 * one first, and the consequence under them follow.
 */
export const OpenHeader = ({ item, data, children }: OpenHeaderProps) => {
  const { headline, provenance, by = item.roleId } = openRowWords(item, data);
  return (
    <>
      {headline ? <p className="needs-headline">{headline}</p> : null}
      {children}
      {provenance ? (
        <p className="needs-who">
          {by ? <RoleAvatar agentRole={by} size="small" /> : null}
          <span>{provenance}</span>
        </p>
      ) : null}
    </>
  );
};
