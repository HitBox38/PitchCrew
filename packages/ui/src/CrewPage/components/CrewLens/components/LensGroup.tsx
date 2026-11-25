import { useId } from 'react';
import { Link } from '@tanstack/react-router';
import { ChevronDown } from 'lucide-react';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@pitchcrew/design-system/collapsible';
import { Bead } from '@/ClayInterface/components/Bead.tsx';
import type { LensGroup as Group } from '@/lib/crew-lens.ts';
import { groupList } from '../constants.ts';
import { moveBetweenEntries } from '../focus.ts';
import { groupLabel, keepSeparators, stampTone } from '../helpers.ts';
import { LensLink } from './LensLink.tsx';
import { LensStamp } from './LensStamp.tsx';

/**
 * Several jobs in one state as one entry: up to three names on line one and why they wait on line
 * two ("All 3 wait for a free work slot, not for Scout"). It opens to the first five jobs, each
 * with its own stamp and its own place (Home's item or Queue), then "and N more in Queue".
 */
export const LensGroup = ({ group, agent }: { group: Group; agent: string }) => {
  const detail = useId();
  const hidden = group.entries.length - groupList;
  return (
    <Collapsible render={<li />} className="crew-lens-entry" data-state={group.state} data-group="">
      <Bead tone={group.tone} size="sm" className="crew-lens-bead" />
      <CollapsibleTrigger
        className="crew-lens-open"
        aria-label={groupLabel(agent, group)}
        aria-describedby={detail}
        data-lens-stop=""
        onKeyDown={moveBetweenEntries}
      >
        <span className="crew-lens-line">
          <strong className="crew-lens-subject">{group.names}</strong>
        </span>
        <LensStamp stamp={group.stamp} tone={stampTone(group)} />
        <span className="crew-lens-detail" id={detail}>
          {group.action ? `${group.action} · ` : null}
          {keepSeparators(group.detail)}
        </span>
      </CollapsibleTrigger>
      <span className="crew-lens-control">
        <ChevronDown size={16} className="crew-lens-pointer crew-lens-chevron" aria-hidden="true" />
      </span>
      <CollapsibleContent className="crew-lens-group-panel">
        <ul>
          {group.entries.slice(0, groupList).map((entry) => (
            <li key={entry.key}>
              <LensLink entry={entry} className="crew-lens-member">
                <span className="crew-lens-member-name">{entry.subject}</span>
                <LensStamp
                  stamp={entry.stamp}
                  tone={stampTone(entry)}
                  className="crew-lens-member-stamp"
                />
              </LensLink>
            </li>
          ))}
        </ul>
        {hidden > 0 ? (
          <Link to="/queue" className="crew-lens-more">
            and {hidden} more in Queue
          </Link>
        ) : null}
      </CollapsibleContent>
    </Collapsible>
  );
};
