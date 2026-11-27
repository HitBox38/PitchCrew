import { Fragment, useId } from 'react';
import type { AttentionTier } from '@/lib/attention.ts';
import type { DeskSection } from '../types.ts';
import { DeskRow, type EntryProps } from './DeskRow.tsx';
import { NeedsFold } from './NeedsFold.tsx';

type NeedsTierProps = Omit<EntryProps, 'entry'> & {
  section: DeskSection;
  fold: (tier: AttentionTier, open: boolean) => void;
};

/**
 * One group of the desk: a tier still waiting, under a caption saying why it ranks where it does,
 * or a run of adjacent all-decided tiers under one "Decided", so screen readers hear one group of
 * what was decided. The caption names the group; each row keeps the shared accordion trigger's
 * heading. Then each tier's rows, and its fold for the rest.
 */
export const NeedsTier = ({ section, fold, ...props }: NeedsTierProps) => {
  const caption = useId();
  return (
    <fieldset
      className="needs-tier"
      aria-labelledby={caption}
      data-tier={section.tier}
      data-decided={section.decided ? '' : undefined}
    >
      <p id={caption} className="needs-tier-caption">
        <span>{section.caption}</span>
      </p>
      {section.tiers.map((group) => (
        <Fragment key={group.tier}>
          {group.shown.map((entry) => (
            <DeskRow key={entry.key} entry={entry} {...props} />
          ))}
          {group.folded.length ? (
            <NeedsFold
              folded={group.folded}
              open={props.desk.unfolded.has(group.tier)}
              onOpenChange={(open) => fold(group.tier, open)}
              {...props}
            />
          ) : null}
        </Fragment>
      ))}
    </fieldset>
  );
};
